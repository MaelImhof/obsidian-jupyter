# Embed View Support

The *Jupyter for Obsidian* plugin supports embedding Jupyter notebooks in
other Obsidian notes in reading mode, using the
[Obsidian feature to embed files in notes](https://obsidian.md/help/embeds).

![Screenshot of an Embed View in read mode](/images/embed-view.png)

Implementing embed view support was not trivial, because the documentation
for that part of the Obsidian API, as far as I could tell, is very sparse. I
had to "reverse-engineer" the functionality implemented in the
[Obsidian Excalidraw plugin](https://github.com/zsviczian/obsidian-excalidraw-plugin)
to understand what needed to be done.

I'm documenting my conclusions and the implementation details here, in case I
need to revisit this in the future, or if anyone else is interested in
implementing embed view support for their own plugin.

::: info
Note that since I had to reverse-engineer the functionality, there may be
some details that I missed or misunderstood, and the implementation may not
be perfect. If you have any suggestions for improvements, please let me know!
:::

## Embed API

### What is an embed?

An "embed" in Obsidian is a way to display the content of a file in a context
that is not the file's tab.

The most common way to use embeds is in another note using the `![[file]]`
syntax. This is similar to how images are embedded with `![[image.png]]`, but
for any file type. Another common use case is hovering over a `[[link]]`,
which shows a popover preview of the file's content.

Obsidian handles common formats natively (images, PDFs, audio, video, notes),
and plugins can extend this to custom file types via the DOM-based API
described below.

There are three distinct contexts where an embed can appear:

- **Reading mode**: the containing note is displayed as rendered HTML.
  Simplest case to handle.
- **Live Preview mode**: the containing note is being edited with rendered
  preview (Obsidian's default editing experience). This is probably the most
  commonly used context, but also a more complex one to handle.
- **Hover preview**: the user hovers over a `[[link]]` and Obsidian shows a
  temporary popover.

Each context requires a slightly different approach, because Obsidian renders
the DOM differently in each.

### Reading mode

This is the simplest case. The markdown post-processor receives the rendered
HTML, and `.internal-embed` elements are already present. The general pattern
for handling embeds in reading mode is:

1. Inside the post-processor callback, query `element.querySelectorAll('.internal-embed')`.
2. Check the `src` attribute for your file extension.
3. Resolve the file via `metadataCache.getFirstLinkpathDest()`.
4. Replace the `.internal-embed` with your custom content.
5. If the content needs event subscriptions or other lifecycle management,
   create a `MarkdownRenderChild` and register it with `context.addChild()`.

#### How embeds appear in the DOM

In **reading mode**, Obsidian's markdown renderer converts `![[file]]` syntax
into a `<span>` (or `<div>` for block embeds) with the class `.internal-embed`.
The `src` attribute contains the filename:

| User writes | HTML element | `src` attribute |
|---|---|---|
| `![[file.ipynb]]` | `<span class="internal-embed" src="file.ipynb">` | `file.ipynb` |
| `![[folder/file.ipynb]]` | `<span class="internal-embed" src="folder/file.ipynb">` | `folder/file.ipynb` |
| `![[file.ipynb#section]]` | `<span class="internal-embed" src="file.ipynb#section">` | `file.ipynb#section` |

The `src` value is relative to the current note's path, or it can be a wiki
link. To resolve it to a `TFile`, use
`metadataCache.getFirstLinkpathDest(src, ctx.sourcePath)`.

#### The `registerMarkdownPostProcessor()` API

This is the primary hook for intercepting embeds in reading mode. It's a method
on the `Plugin` class:

```ts
plugin.registerMarkdownPostProcessor(
  (element: HTMLElement, context: MarkdownPostProcessorContext) => {
    // element is a section of the rendered note (paragraph, block, etc.)
    // context contains sourcePath, frontmatter, addChild(), etc.
  }
);
```

Obsidian calls this callback for each section of the rendered note. Inside the
callback you can query the DOM, create new elements, and register lifecycle
components. The post-processor is automatically cleaned up when the plugin
unloads.

#### The `MarkdownRenderChild` lifecycle

`MarkdownRenderChild` is a base class for components that live inside a
rendered markdown section. It provides:

- **`onload()`**: called when the child is added to the render context. Use it
  to subscribe to events, start intervals, etc.
- **`onunload()`**: called when the parent section is removed from the DOM. Use
  it to clean up subscriptions and prevent memory leaks.

Register a child with `context.addChild(child)` so Obsidian manages its
lifecycle automatically.

### Live Preview mode

In Live Preview, there are no `.internal-embed` elements in the DOM. The
embedded content is rendered inline within the editor. To handle this case,
you need to access `context.containerEl` — a private property on the
`MarkdownPostProcessorContext` (accessed via `//@ts-ignore`). From there,
you walk up the DOM tree to find wrapping elements like `.cm-embed-block`
or `.cm-preview-code-block`. This is the approach I found in the Excalidraw
plugin.

This case is **not yet implemented** in Jupyter for Obsidian.

### Hover preview

When the user hovers over a `[[link]]` in reading mode, Obsidian fires a
`hover-link` event on `app.workspace`. The event object carries `linktext`
(the linked filename) and `sourcePath`. You can inspect `linktext` for your
file extension and render a preview.

You can also use a `MutationObserver` on `document.body` as a fallback,
watching for `.popover.hover-popover` elements being added to the DOM — this
is how the Excalidraw plugin handles older Obsidian versions.

This case is **not yet implemented** in Jupyter for Obsidian.

## Implementation Details

### High-level architecture

The feature lives in `src/features/embed-notebooks/` and consists of:

| File | Role |
|---|---|
| `embed-notebooks-feature.ts` | Registers the markdown post-processor; contains the `NotebookEmbedChild` lifecycle class |
| `embed-notebooks-settings.ts` | Settings interface, defaults, and settings UI registration |

### How `EmbedNotebooksFeature` works

The feature class implements the `IFeature` interface and is registered in
`src/jupyter-for-obsidian.ts`. On load it:

1. Registers its settings UI in the plugin's settings tab.
2. Registers a markdown post-processor via `registerMarkdownPostProcessor()`.

Inside the post-processor callback, `processReadingMode()` scans the section
for `.internal-embed` elements whose `src` ends with `.ipynb`, resolves the
file, and replaces the element with a `NotebookEmbedChild`-managed container.

### The `NotebookEmbedChild` lifecycle

`NotebookEmbedChild` extends `MarkdownRenderChild`:

- **`onload()`**: subscribes to `JupyterEnvironmentEvent.CHANGE` and calls
  `render()`. The event subscription is what makes the embed update live when
  the Jupyter server starts or stops — no manual refresh needed.
- **`onunload()`**: unsubscribes from the event to prevent listener leaks.
- **`render()`**: clears the container and rebuilds the DOM based on the
  current Jupyter environment status.

### Three visual states

| State | What the user sees |
|---|---|
| `RUNNING` | A `<webview>` element loading the notebook from the Jupyter server URL. The height is user-configurable via settings (default: 500px). No title bar — the webview has its own. |
| `STARTING` | A message "Jupyter is starting…" plus a title bar with the filename. Compact height (auto-sized to content). |
| `EXITED` | A message "Jupyter is not running…" with a **Start Jupyter** button, plus a title bar. Compact height. |

The title bar (filename) is only shown in the `STARTING` and `EXITED` states.
When the notebook is displayed (`RUNNING`), the webview's own interface
already includes the filename, so showing it again would be redundant.

### Rendering the notebook (webview)

I use Electron's `<webview>` element (not a standard `<iframe>`) to embed the
Jupyter interface. This is the same approach as the `EmbeddedJupyterView`
class in `src/services/jupyter-view.ts` for full-page notebook viewing.

The URL is obtained from `env.getFileUrl(filePath)`, which returns a URL like:
```
http://localhost:{port}/{notebooks|lab/tree}/{path}?token={token}
```

### Settings

The embed height is configurable via **Settings → Plugin customization →
Embedded notebook height**, with a slider from 200 to 2000 pixels in 50px
increments. The value is applied as an inline style on the `<webview>` element.

### Cases not yet implemented

1. **Live Preview mode**: In editing/live-preview, there are no `.internal-embed`
   elements in the DOM. The Excalidraw plugin handles this by walking up from
   `ctx.containerEl` (using `@ts-ignore` since it's a private API) to find
   wrapping elements with classes like `cm-embed-block`.

2. **Hover preview**: When hovering over a `[[link]]` to a `.ipynb` file, Obsidian
   shows a popover. The Excalidraw plugin handles this with the
   `app.workspace.on("hover-link", ...)` event.
