# Embed View Support

::: warning
This page is written with AI for now, to keep track of the steps I took
during the journey of implementing embeds. I intend to rewrite this
documentation once the implementation is clean, so that it is more useful
than the brain dump it currently is.
:::

The *Jupyter for Obsidian* plugin supports embedding Jupyter notebooks in
other Obsidian notes — in reading mode, live preview mode, and as hover
previews for in-note links — using the
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

Same starting assumption as Live Preview: based on the Excalidraw plugin's
handling of its own non-markdown "legacy" file format, I expected to need
`app.workspace.on('hover-link', ...)` plus a `MutationObserver` watching for
`.popover.hover-popover` elements. I confirmed this empirically this time
before writing any implementation, by logging both the `hover-link` event
and the post-processor callback across three different hover contexts.

#### `hover-link` fires from multiple surfaces, distinguished by `source`

| Surface | `source` | Trigger | `targetEl` |
|---|---|---|---|
| Reading mode, in-note link | `'preview'` | Hover only | `a.internal-link` |
| Live Preview, in-note link | `'editor'` | Ctrl/Cmd + hover | `span.cm-hmd-internal-link` |
| File explorer | `'file-explorer'` | Ctrl/Cmd + hover for a popover; the event itself still fires on plain hover | `div.tree-item-self...` |

The event also carries `hoverParent` and `targetEl`, beyond the
`linktext`/`sourcePath` the original assumption was based on. `sourcePath`
was present for in-note links but absent for the file explorer case — there
`linktext` is already an absolute vault path (e.g. `'Notebook
creation/Invalid notebook.ipynb'`), so there's no source note to resolve it
against.

#### The post-processor never fires for `.ipynb`, in any of the three contexts

For `.md` links, the post-processor fires 2-4 times while the popover is
built, rendering the target note's content — the same "post-processors run
per rendered section" behavior already seen for reading-mode embeds. For
`.ipynb` links, across all three contexts (reading mode, Live Preview, file
explorer), it fires **zero times**. Same file-type-driven cause as Live
Preview embeds: `.ipynb` is JSON, not markdown, so there's no
`MarkdownRenderer` pass to hook into, regardless of how the popover was
triggered.

#### The default `.ipynb` popover DOM

```html
<div class="popover hover-popover" style="...">
  <div class="file-embed mod-generic is-loaded">
    <div class="file-embed-title">
      <span class="file-embed-icon">...</span> Welcome.ipynb
    </div>
  </div>
</div>
```

Two differences from the Live Preview `.internal-embed` case:

- **No `.internal-embed` class, and no `src`/`data-href` attribute anywhere**
  in the popover. There's nothing in the popover's own DOM to read the
  target file from — unlike the embed case, this is entirely dependent on
  the `hover-link` event's cached `linktext`/`sourcePath`, correlated by
  timing with the `MutationObserver` callback. This is exactly why
  Excalidraw's own legacy-file hover handling works the same way.
- **Not a CM6 widget.** This popover is a disposable overlay — created on
  hover-in, destroyed on hover-out — with no editor/document reconciliation
  involved. So the "never replace the outer node" rule from Live Preview
  doesn't apply here: replacing/rebuilding the popover's content outright is
  safe, matching what Excalidraw's own legacy-hover code does (`node.empty()`
  + rebuild).

For comparison, the `.md` popover looks like a scaled-down `MarkdownView`:
`.popover.hover-popover > .markdown-embed > .markdown-embed-content >
.markdown-preview-view.markdown-rendered > ...`, with the note's actual
rendered content nested several levels deep, plus an inline title and
metadata section. This is why the post-processor is invoked for it: it's a
real markdown render pass, not a placeholder.

#### Scope

For now this only covers `[[links]]` hovered inside a note (reading mode or
Live Preview). File explorer hover previews are deferred — a known future
addition, not yet implemented.

::: info
Implementation details below reflect what was actually built; see git
history/PRs for how this evolved if the two ever drift.
:::

## Implementation Details

### High-level architecture

::: warning
**Dev gotcha**: `styles.css` at the repo root is `.gitignore`d — it's a
build artifact, only ever populated by `npm run build -- production`,
which copies *from* `test-vault/.obsidian/plugins/jupyter/styles.css` *to*
the repo root for the release bundle, never the other way. That vault-local
file is the actual git-tracked source of truth the dev instance of
Obsidian loads. Edit `test-vault/.obsidian/plugins/jupyter/styles.css`
directly — editing the root copy silently does nothing (it doesn't reach
the running vault, and the next production build overwrites it anyway).
Cost real time once already; don't repeat it.
:::

The feature lives in `src/features/embed-notebooks/` and consists of:

| File | Role |
|---|---|
| `embed-notebooks-feature.ts` | Registers the markdown post-processor for reading mode; wires up live preview and hover preview support on load |
| `embed-notebooks-shared.ts` | The `NotebookEmbedChild` lifecycle class, shared by both reading mode and live preview |
| `embed-notebooks-live-preview.ts` | `MutationObserver`-based live preview embed support (see below) |
| `embed-notebooks-hover-preview.ts` | `MutationObserver`-based hover preview support (see below) |
| `embed-notebooks-settings.ts` | Settings interface, defaults, and settings UI registration |

### How `EmbedNotebooksFeature` works

The feature class implements the `IFeature` interface and is registered in
`src/jupyter-for-obsidian.ts`. On load it:

1. Registers its settings UI in the plugin's settings tab.
2. Registers a markdown post-processor via `registerMarkdownPostProcessor()`,
   for reading mode.
3. Calls `setupLivePreview()`, for live preview mode, and stores the
   returned cleanup handle to call on `onunload()`.
4. Calls `setupHoverPreview()`, for hover preview, likewise storing its
   cleanup handle.

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
isn't a markdown editor leaf — a Canvas card, another plugin's custom view
that renders markdown content, or an unusual hover-preview context this
plugin doesn't yet handle — the leaf lookup finds no owner, and the code
falls back to `app.workspace.getActiveFile()`, which may resolve relative
links against the wrong file. This is an accepted tradeoff for now: it only
affects contexts this plugin doesn't yet support or that fall outside
typical note-embeds-a-notebook usage, not the main case this feature
targets. Note that hover preview (see below) doesn't go through
`resolveSourcePath()` at all — it gets `sourcePath` directly from the
`hover-link` event instead, which is a more reliable source of truth than
DOM containment anyway.

**Known limitation**: Obsidian's "open note in a new window" feature opens
a note in a separate `document`. This observer only watches the main
window, so embeds in a note opened in a popout window won't get live
preview support — they'll show Obsidian's default fallback embed instead.
Fixing this would mean listening for the `window-open` workspace event and
attaching an additional observer scoped to that window's `document`. Not
yet implemented.

### Hover preview

`setupHoverPreview()` (in `embed-notebooks-hover-preview.ts`) follows the
reasoning laid out earlier in this document:

- **Tracking the hovered link**: subscribes to `app.workspace.on('hover-link', ...)`,
  filtered to `source === 'preview' || source === 'editor'` (in-note links —
  file explorer hovers are ignored, out of scope for now). Caches the most
  recent `{ linktext, sourcePath }`, clearing it whenever an event fires
  without a `linktext` (hover ended) — the same pattern Excalidraw uses for
  its own equivalent caching.
- **Detection**: a `MutationObserver` on `document.body`, non-subtree
  (popovers are appended as direct children, confirmed empirically and
  matching Excalidraw's own scoping for this exact case), watching for
  `.popover.hover-popover` nodes. When one appears, the cached `linktext` is
  resolved via `metadataCache.getFirstLinkpathDest` — if it's a `.ipynb`
  file, the popover gets rebuilt.
- **DOM strategy**: unlike the Live Preview embed, this popover isn't a CM6
  widget — it's a disposable overlay with no editor reconciliation involved
  — so `popoverEl.empty()` followed by a full rebuild is safe.
- **Preview content**: reads the notebook directly via `vault.cachedRead()`
  and parses the JSON — deliberately independent of `JupyterEnvironment`,
  so hovering a link never starts the Jupyter server or waits on it. Shows
  the filename, a cell count, and the first markdown cell's source (if
  any), truncated to 200 characters before rendering.
- **Rendering the snippet as real markdown**: the first markdown cell's
  raw source (each `.ipynb` source line already ends in `\n`, joined with
  `''`) is *not* shown as plain text — `setText()` into a `<p>` collapses
  all those newlines into one flowed, unreadable blob, headings and all.
  Instead it goes through Obsidian's public `MarkdownRenderer.render(app,
  markdown, el, sourcePath, component)`, the same API a real `.md` hover
  preview effectively uses, so headings/emphasis/paragraph breaks render
  properly.
- **Component lifecycle for the rendered snippet**: `MarkdownRenderer.render()`
  can register child components (nested links/embeds within the markdown),
  so each rendered snippet gets its own `Component`, tracked in a
  `popoverEl -> Component` map. The `MutationObserver` callback also
  watches `mutation.removedNodes` (not just `addedNodes`) to `unload()` and
  untrack the component when its popover is dismissed — the live preview
  and reading-mode embeds don't need this since they reuse `NotebookEmbedChild`,
  whose lifecycle Obsidian already manages via `MarkdownRenderChild`/`ctx.addChild()`.
- **Async safety**: reading and parsing the file, and rendering the
  markdown, are both asynchronous, so by the time either resolves the
  popover may already have been dismissed (fast hover-away). Both
  `renderPreview()` (before rendering) and the code right after
  `MarkdownRenderer.render()` resolves check `document.body.contains(popoverEl)`
  before touching/tracking it.
- **Styling is fully self-contained** (`jupyter-hover-preview*` classes in
  `styles.css`), not borrowed from Obsidian's own `embed-title`/
  `markdown-embed-title` classes — those are only styled by the active
  theme when nested inside an `.internal-embed`/`.markdown-embed` ancestor,
  which this bare popover doesn't have. Same "don't rely on ambient
  inherited context" lesson learned earlier while unifying the embed's
  starting/exited message styling across reading mode and Live Preview
  (see `renderJupyterMessage()` in `src/services/jupyter-message.ts`), just
  caught before shipping this time instead of after.

### Cases not yet implemented

1. **File explorer hover preview**: hovering a `.ipynb` file in the file
   explorer (with Ctrl/Cmd held) also shows a popover, following the same
   `.file-embed.mod-generic` placeholder shape, via `hover-link`'s
   `source: 'file-explorer'`. Deliberately deferred — see the "Hover
   preview" section above.

2. **Live preview in popout windows**: see the known limitation noted above.
