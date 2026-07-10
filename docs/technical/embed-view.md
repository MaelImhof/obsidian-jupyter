# Embed View Support

::: warning
This page is written with AI for now, to keep track of the steps I took
during the journey of implementing embeds. I intend to rewrite this
documentation once the implementation is clean, so that it is more useful
than the brain dump it currently is.
:::

The *Jupyter for Obsidian* plugin supports embedding Jupyter notebooks in
other Obsidian notes, in both reading mode and live preview mode, using the
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
and plugins can extend this to custom file types, though there are some
differences according to what I found.

There are three distinct contexts where an embed can appear:

- **Reading mode**: the containing note is displayed as rendered HTML,
  read-only mode. Simplest case to handle.
- **Live Preview mode**: the containing note is being edited with rendered
  preview (Obsidian's default editing experience). This is probably the most
  commonly used context, but also a more complex one to handle.
- **Hover preview**: the user hovers over a `[[link]]` and Obsidian shows a
  temporary popover.

Note that the file extension seems to matter. For example, implementing
embeds for a format stored in `.md` documents (a native Obsidian format) is
not the same as implementing embeds for `.ipynb` (a format Obsidian does not
support natively). More on this in live preview details.

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
into a `<div>` with the class `.internal-embed`.
The `src` attribute contains the filename:

| User writes | HTML element | `src` attribute |
|---|---|---|
| `![[file.ipynb]]` | `<div class="internal-embed" src="file.ipynb">` | `file.ipynb` |
| `![[folder/file.ipynb]]` | `<div class="internal-embed" src="folder/file.ipynb">` | `folder/file.ipynb` |
| `![[file.ipynb#section]]` | `<div class="internal-embed" src="file.ipynb#section">` | `file.ipynb#section` |

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

My first assumption, based on reading the Excalidraw plugin's source, was
that Live Preview has no `.internal-embed` elements in the DOM at all, and
that the fix was to read `context.containerEl` — a private property on
`MarkdownPostProcessorContext` (accessed via `//@ts-ignore`) — and walk up
the DOM tree looking for wrapping elements like `.cm-embed-block` or
`.cm-preview-code-block`.

That assumption turned out to be wrong for `.ipynb`. I confirmed empirically
(by logging inside the post-processor callback and inspecting the live
DOM) that:

- Obsidian **does** create a `.internal-embed` element for `.ipynb` in Live
  Preview — its default fallback for a file type it doesn't natively
  recognize, rendered as
  `<div class="internal-embed file-embed mod-generic" src="...">`.
- `registerMarkdownPostProcessor()` is **never called** on it. Not once,
  not for any section of the note — not just for the embed.

The reason turned out to be about file type, not rendering mode.
`.internal-embed` placeholders always appear in the DOM in reading mode
because `MarkdownRenderer` renders the *entire* note, section by section,
before post-processors run over each section — this happens unconditionally,
regardless of what a section contains. A `.ipynb` file is JSON, not
markdown, so there is no equivalent unconditional pass in Live Preview:
Obsidian's fallback "unrecognized file" embed widget is built by an
internal, native CM6 extension that has no reason to invoke
`registerMarkdownPostProcessor`, since there's no markdown content to
render.

This explains why the Excalidraw approach works for Excalidraw, and why it
doesn't transfer directly to `.ipynb`. Excalidraw's primary file format is
an ordinary `.md` file with a JSON payload in a code fence — genuinely
markdown, so `MarkdownRenderer` recursively renders its embedded content
in *both* modes, invoking post-processors either way. The `ctx.containerEl`
walk is there to let the same post-processor callback detect *when* it's
running inside a Live Preview embed wrapper (to swap the rendered code
fence for an image), not to discover the embed in the first place.

Tellingly, Excalidraw also supports a non-markdown "legacy" raw
`.excalidraw` file format (plain JSON, no `.md` wrapper) — the same
situation `.ipynb` is in. It has **no Live Preview embed support for that
format**. From the plugin's own 1.4.9 release notes: *"A bridging solution
to support Obsidian 0.13.2 WYSIWYG until markdownPostProcessor is
implemented natively. This only works for Excalidraw.md files. Sadly I
can't offer a solution for legacy .excalidraw files."* Its only
`MutationObserver` usage in the whole codebase is unrelated to Live
Preview — it's a narrow fallback that watches for hover-preview popovers
on old Obsidian versions.

Since `.ipynb` can't be represented as markdown without breaking
compatibility with the wider Jupyter ecosystem (the whole point of this
plugin), there's no post-processor hook available for Live Preview embeds.
The only way to hook in is a `MutationObserver` watching for the native
`.internal-embed[src$=".ipynb"]` placeholder to appear, then modifying its
*interior*.

#### Why the `.internal-embed` element itself can't be replaced

Early on, replacing the `.internal-embed` node outright (the same
`replaceChild` approach reading mode uses) caused Live Preview to break.
The reason: in Live Preview, that specific DOM node isn't just inert
markup — it's a widget Obsidian's own CM6 extension owns and tracks
internally. Swapping it for a new node breaks Obsidian's bookkeeping for
that widget.

The fix is to **keep the `.internal-embed` element in place** and insert a
container we fully own as a child of it, then only ever mutate inside that
container. Obsidian only tracks the outer node's *presence*, not its
inner content, so this is safe.

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
| `embed-notebooks-feature.ts` | Registers the markdown post-processor for reading mode; wires up live preview support on load |
| `embed-notebooks-shared.ts` | The `NotebookEmbedChild` lifecycle class, shared by both reading mode and live preview |
| `embed-notebooks-live-preview.ts` | `MutationObserver`-based live preview embed support (see below) |
| `embed-notebooks-settings.ts` | Settings interface, defaults, and settings UI registration |

### How `EmbedNotebooksFeature` works

The feature class implements the `IFeature` interface and is registered in
`src/jupyter-for-obsidian.ts`. On load it:

1. Registers its settings UI in the plugin's settings tab.
2. Registers a markdown post-processor via `registerMarkdownPostProcessor()`,
   for reading mode.
3. Calls `setupLivePreview()`, for live preview mode, and stores the
   returned cleanup handle to call on `onunload()`.

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

### Live Preview mode

`setupLivePreview()` (in `embed-notebooks-live-preview.ts`) sets up a single
`MutationObserver`, following the reasoning laid out earlier in this
document:

- **Detection**: the observer watches for `.internal-embed[src$=".ipynb"]`
  elements being added to the DOM — Obsidian's native fallback embed for a
  file type it doesn't recognize. A `data-jupyter-embed-processed`
  attribute marks embeds already handled, to avoid double-processing.
- **DOM strategy**: unlike reading mode's `replaceChild`, the outer
  `.internal-embed` node is left untouched. A container `div` we fully own
  is inserted as its child, and a `NotebookEmbedChild` (the same class used
  in reading mode) is mounted inside that container — reusing the existing
  three-state rendering logic rather than duplicating it.
- **Observer scope**: the observer watches `app.workspace.containerEl`
  (the whole leaf/pane layout) rather than `document.body`. This is a
  single observer — not one per open editor/leaf — since splitting it up
  wouldn't reduce the total DOM churn watched (only the actively-edited
  pane produces meaningful churn at a given moment) while adding real
  complexity in tracking observer lifecycle across leaf open/close/split/
  mode-switch events. Scoping to `workspace.containerEl` instead of
  `document.body` still cuts out unrelated churn from modals, the command
  palette, and other non-workspace UI, for free.
- **Cheap guards against unrelated churn**: typing anywhere in any open
  note creates and destroys many small CM6 decoration nodes, all of which
  pass through this observer's callback. Two guards keep that cheap:
  `processNodeForEmbeds` skips the `.internal-embed` subtree scan for leaf
  nodes (`childElementCount === 0`), and `cleanupRemovedNode` does the same
  before checking whether a removed node contained any tracked embeds
  (checking containment from the removed node itself, rather than checking
  `document.body.contains()` for every tracked embed on every unrelated
  removal).
- **Resolving `sourcePath`**: a `MutationObserver` callback has no
  `MarkdownPostProcessorContext`, so there's no `ctx.sourcePath` to resolve
  relative links against. `resolveSourcePath()` finds the open markdown
  leaf whose `containerEl` contains the mutated embed node
  (`app.workspace.getLeavesOfType('markdown')`) and uses that leaf's file —
  falling back to `app.workspace.getActiveFile()` only if no leaf matches.
  This is all public, documented Obsidian API (`Workspace.getLeavesOfType`,
  `View.containerEl`), unlike the private, `@ts-ignore`d `ctx.containerEl`
  that Excalidraw relies on for its own equivalent needs.

**Known limitation**: `resolveSourcePath()` only checks currently open
`markdown`-type leaves. If an `.ipynb` embed ever appears somewhere that
isn't a markdown editor leaf — a hover preview popover (not yet
implemented, see below), a Canvas card, or another plugin's custom view
that renders markdown content — the leaf lookup finds no owner, and the
code falls back to `app.workspace.getActiveFile()`, which may resolve
relative links against the wrong file. This is an accepted tradeoff for
now: it only affects contexts this plugin doesn't yet support or that fall
outside typical note-embeds-a-notebook usage, not the main case this
feature targets. Worth revisiting if hover preview is implemented, or if
this turns out to matter for some other embed context.

**Known limitation**: Obsidian's "open note in a new window" feature opens
a note in a separate `document`. This observer only watches the main
window, so embeds in a note opened in a popout window won't get live
preview support — they'll show Obsidian's default fallback embed instead.
Fixing this would mean listening for the `window-open` workspace event and
attaching an additional observer scoped to that window's `document`. Not
yet implemented.

### Cases not yet implemented

1. **Hover preview**: When hovering over a `[[link]]` to a `.ipynb` file, Obsidian
   shows a popover. The Excalidraw plugin handles this with the
   `app.workspace.on("hover-link", ...)` event.

2. **Live preview in popout windows**: see the known limitation noted above.
