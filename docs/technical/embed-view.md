# Embed View Support

*Jupyter for Obsidian* lets you embed a Jupyter notebook inside another note
with the same `![[file]]` syntax Obsidian uses for images, PDFs, or other
notes. See also the [Obsidian docs on embedding files](https://obsidian.md/help/embeds).

![Screenshot of an Embed View in read mode](/images/embed-view.png)

Obsidian's embed API is not documented for arbitrary file types, so most of
what follows was worked out by instrumenting Obsidian itself (adding
temporary logging, inspecting the live DOM) rather than from any official
reference. This page describes what was found and why the implementation
ended up shaped the way it is, mainly so a future change to this feature
doesn't have to re-derive it from scratch.

## The three ways an embed can appear

Obsidian can show the contents of an embedded file in three different UI
contexts, and each one renders the embed through different internal
machinery:

- **Reading mode** — the note is displayed as static, rendered HTML. The
  embed appears inline, in place of the `![[file]]` syntax.
- **Live Preview** — the note is open for editing, with formatting rendered
  inline (Obsidian's default editing experience, built on CodeMirror 6).
  The embed appears inline here too, but through a different code path than
  reading mode.
- **Hover preview** — hovering a `[[link]]` (holding Ctrl/Cmd where
  required) shows a temporary popover with a preview of the linked file,
  without navigating to it.

A notebook embedded via any of these can itself be in one of three states,
depending on whether the Jupyter server is running, like normal Jupyter
views: **starting**, **not running** (with a button to start it), or
**running** (showing the actual notebook in a `<webview>`). This states
machinery is shared across all three contexts (see
[`NotebookEmbedChild`](#notebookembedchild)).

## The core problem: `.ipynb` is not markdown

Every other piece of this feature follows from one fact: **`.ipynb` files
are JSON, not markdown**, and Obsidian's main extensibility hook for
embeds
([`registerMarkdownPostProcessor()`](https://docs.obsidian.md/Reference/TypeScript+API/Plugin/registerMarkdownPostProcessor))
only ever fires as part of rendering *markdown* content.

This was confirmed empirically, by testing two different things separately.
Logging was added inside the post-processor callback and around the
`hover-link` workspace event, then:

- A `.ipynb` **embed** (`![[file.ipynb]]`) was checked in both reading mode
  and Live Preview.
- A `.ipynb` **hover popover** was checked from each of the three surfaces
  a hover can come from: a link hovered while reading a note, a link
  hovered in Live Preview, and a file explorer item.

Results: a `.md` embed or hover popover reliably triggers the
post-processor everywhere, rendering the target note's actual content. A
`.ipynb` embed triggers it in reading mode (that's the mechanism the
reading mode implementation relies on, see below) but never in Live
Preview. A `.ipynb` hover popover never triggers it, regardless of which of
the three surfaces it was hovered from (including a link hovered while
the note is in reading mode, which is easy to conflate with the embed case
above, but is a different code path).

The reason is about content type, not about which of the three contexts is
active. Reading mode renders an entire note through `MarkdownRenderer`,
section by section, and calls every registered post-processor on each
section, unconditionally, regardless of what that section contains. That's
why a `.ipynb` embed placeholder still gets a chance to be intercepted in
reading mode: it's swept up by a pass that was going to happen anyway. Live
Preview and hover preview have no equivalent unconditional pass. When
either needs to show an embed for a file type it doesn't recognize, it
builds a generic placeholder:

```html
<!-- In Live Preview -->
<div class="internal-embed file-embed mod-generic">

<!-- In Hover Preview -->
<div class="popover hover-popover">
```

through an internal code path that has no reason to invoke
`MarkdownRenderer`, since there is no markdown to render.

Practically, this means:

- **Reading mode** can use the standard post-processor pattern.
- **Live Preview** and **hover preview** cannot. The best solution that was
  found is to use a `MutationObserver` watching for the placeholder to
  appear, and DOM inspection is the only source of truth for what to render,
  correlated with contextual information (the target file, the source note)
  that can't come from a `MarkdownPostProcessorContext` that never gets
  created.

::: info Why not do what other plugins do?
The [Excalidraw plugin](https://github.com/zsviczian/obsidian-excalidraw-plugin)
was checked as a possible reference while implementing the feature. Its
embeds work in Live Preview and hover preview, but only because its primary
file format is an ordinary `.md` file with a JSON payload in a code fence,
which *is* markdown, so `MarkdownRenderer` recursively renders it in every
context. Tellingly, Excalidraw also supports a non-markdown "legacy" raw
`.excalidraw` format (plain JSON, same situation `.ipynb` is in), and its
own release notes say plainly it has no Live Preview support for that
format either: *"Sadly I can't offer a solution for legacy .excalidraw
files."*
:::

## Reading mode

Obsidian's markdown renderer converts

```md
![[file.ipynb]]
```

into a

```html
<div class="internal-embed" src="file.ipynb">
```

inside the rendered section. The `src` attribute carries the link target,
as written in the original embed link (the value is a wikilink):

| User writes | `src` attribute |
|---|---|
| `![[file.ipynb]]` | `file.ipynb` |
| `![[folder/file.ipynb]]` | `folder/file.ipynb` |
| `![[file.ipynb#section]]` | `file.ipynb#section` |

### Implementation

`EmbedNotebooksFeature` (`embed-notebooks-feature.ts`) registers a single
markdown post-processor via `registerMarkdownPostProcessor()`. Its callback,
`processReadingMode()`:

1. Queries the rendered section for `.internal-embed` elements.
2. Filters to ones whose `src` (stripped of any `#section` suffix) ends in
   `.ipynb`.
3. Resolves the link to a `TFile` via
   [`metadataCache.getFirstLinkpathDest(src, ctx.sourcePath)`](https://docs.obsidian.md/Reference/TypeScript+API/MetadataCache/getFirstLinkpathDest).
4. Replaces the `.internal-embed` element outright with a container `div`,
   and mounts a [`NotebookEmbedChild`](#notebookembedchild)
   into it, registered via `ctx.addChild()` so Obsidian manages its
   lifecycle (calling `onunload()` when the section leaves the DOM).

This is the simplest of the three contexts: the DOM is static once
rendered, there's no live editor to conflict with, and `ctx` gives a
correct `sourcePath` and a lifecycle hook for free.

## Live Preview

### How the embed appears

Obsidian still shows *something* for `![[file.ipynb]]` in Live Preview,
just not through a mechanism the post-processor can see. Before this
feature touches anything, it's a generic fallback placeholder:

```html
<div class="internal-embed file-embed mod-generic" src="file.ipynb">
  <!-- Obsidian's own placeholder content -->
</div>
```

### Why the outer element can't be replaced

Early in development, replacing this `.internal-embed` node outright (the
same `replaceChild` approach reading mode uses) broke Live Preview. The
node isn't inert markup here. Obsidian's own Live Preview extension owns
and tracks it as a live widget. Swapping it for a different node breaks
that extension's internal bookkeeping for the widget.

The fix: **leave the `.internal-embed` element in place**, and insert a
container the plugin fully owns as its child, mutating only inside that
container. Obsidian's extension tracks the outer node's *presence*, not its
contents, so this is safe, and it's the same reason
[`NotebookEmbedChild`](#notebookembedchild) can
freely empty and rebuild its own container on every render without issue.

### Implementation

`setupLivePreview()` (`embed-notebooks-live-preview.ts`) sets up a
`MutationObserver` per open window (see
[Popout windows](#popout-windows) below) that:

- **Detects embeds**: watches for `.internal-embed` elements whose `src`
  ends in `.ipynb` being added to the DOM. A `data-jupyter-embed-processed`
  attribute marks ones already handled. To keep this cheap during typing
  (CM6 creates and destroys many small decoration nodes as a side effect of
  normal editing, all of which pass through the observer's callback), leaf
  nodes with `childElementCount === 0` are skipped before doing any subtree
  query, since they can't contain a nested embed.
- **Resolves the source note**: a `MutationObserver` callback has no
  `MarkdownPostProcessorContext`, so there's no `ctx.sourcePath` to resolve
  a relative link against. `resolveSourcePath()` instead searches every
  open `markdown`-type leaf (`workspace.getLeavesOfType('markdown')`) for
  one whose `containerEl` contains the embed node, and uses that leaf's
  file. This is public, documented Obsidian API. If no leaf matches, it
  falls back to `workspace.getActiveFile()` (see
  [Known limitations](#known-limitations)).
- **Builds the embed**: empties the `.internal-embed` element's interior,
  applies inline styles to strip Obsidian's own placeholder chrome
  (padding, border, background), inserts an owned container `div`, and
  mounts a `NotebookEmbedChild` into it directly (calling `.onload()`
  itself, since there's no `ctx.addChild()` to do it here).
- **Cleans up**: each window's embeds are tracked in a
  `Map<HTMLElement, NotebookEmbedChild>`, scoped to that window (see
  [Popout windows](#popout-windows)). When a tracked container (or an
  ancestor of one) is removed from the DOM (e.g. scrolled out of view, or
  its section re-rendered), the corresponding child's `onunload()` runs and
  it's dropped from the map.

### Popout windows

The observer above is attached once per open window via
[`forEachWorkspaceWindow()`](#foreachworkspacewindow), not just to the main
one. For the main window it watches `app.workspace.containerEl`. That element includes the whole leaf/pane layout, but is narrower than `document.body` so
it doesn't fire for churn in modals, the command palette, or other
non-workspace UI. There's no public equivalent to `containerEl` for a popout
`WorkspaceWindow`, so popouts fall back to that window's `document.body`
instead. It is a broader scope, though in practice popouts tend to have
little non-workspace UI chrome to generate false-positive churn from.

Each window also gets its own tracked-embeds map rather than sharing one
globally, so that when a specific window closes, exactly its embeds get
unloaded (see [`forEachWorkspaceWindow()`](#foreachworkspacewindow) for
why this can't be left to the `MutationObserver` to notice on its own).

## Hover preview

### How the popover appears

Same situation as Live Preview: Obsidian shows a placeholder popover for a
`.ipynb` link, through a code path the post-processor never sees.

```html
<div class="popover hover-popover">
  <div class="file-embed mod-generic">
    <div class="file-embed-title">
      <span class="file-embed-icon">...</span> file.ipynb
    </div>
  </div>
</div>
```

Unlike the Live Preview embed, this placeholder carries no `src` or
`data-href` attribute. There's nothing in the popover's own DOM to
identify which file it's for. The target file has to come from elsewhere:
the `hover-link` workspace event, fired just before the popover appears,
carries `linktext` and (for links inside a note) `sourcePath`.

This event fires from three distinct surfaces, distinguished by its
`source` field, all producing the same placeholder shape for `.ipynb`:

| Surface | `source` | Trigger |
|---|---|---|
| Reading mode, in-note link | `'preview'` | Hover only |
| Live Preview, in-note link | `'editor'` | Ctrl/Cmd + hover |
| File explorer | `'file-explorer'` | Ctrl/Cmd + hover (for a popover. The event itself fires on plain hover too) |

`sourcePath` is only present for the first two. A file explorer item isn't
inside a note, so `linktext` there is already an absolute vault path, with
nothing to resolve it against.

### Why the popover can be rebuilt freely

Unlike the Live Preview embed's `.internal-embed` node, this popover isn't
tracked by any editor/CM6 reconciliation. It's a disposable overlay,
created on hover-in and destroyed on hover-out, with no document state
depending on it. Emptying and rebuilding it outright (rather than
preserving the outer node, the way Live Preview requires) is safe.

### Implementation

`setupHoverPreview()` (`embed-notebooks-hover-preview.ts`):

- **Tracks the hovered link**: subscribes once to `workspace.on('hover-link',
  ...)` (an undocumented event, not part of `Workspace`'s typed overloads),
  filtered to the three sources above. Caches the most recent `{ linktext,
  sourcePath }`, clearing it whenever an event fires without a `linktext`
  (the hover ended).
- **Detects the popover**: a `MutationObserver` per open window (see
  [Popout windows](#popout-windows-1)), non-subtree on that window's
  `document.body` (popovers are appended as its direct children). When one
  appears, the cached `linktext` is resolved via
  [`metadataCache.getFirstLinkpathDest`](https://docs.obsidian.md/Reference/TypeScript+API/MetadataCache/getFirstLinkpathDest);
  if it's a `.ipynb` file, the popover gets rebuilt.
- **Renders the preview**: reads the notebook directly via
  `vault.cachedRead()` and parses the JSON (deliberately independent of
  the Jupyter server, so hovering a link never starts it or waits on it).
  Shows the filename, a cell count, and (if the notebook has one) the
  first markdown cell's source, truncated to 200 characters and rendered
  through Obsidian's `MarkdownRenderer.render()`.
- **Manages the rendered snippet's lifecycle**: `MarkdownRenderer.render()`
  can register child components (for nested links/embeds within the
  markdown), so each rendered snippet gets its own `Component`, tracked
  per-window. The `MutationObserver` callback also watches
  `mutation.removedNodes` to `unload()` and untrack the component when its
  popover is dismissed.
- **Guards against async races**: reading the file and rendering the
  markdown are both asynchronous, so the popover may already be dismissed
  by the time either resolves. Both checks use `popoverEl.isConnected`
  (not `document.body.contains(popoverEl)`, which would check against the
  *main* window's document regardless of which window the popover actually
  belongs to).

### Popout windows

Same mechanism as Live Preview: the popover-detection observer is attached
per window via [`forEachWorkspaceWindow()`](#foreachworkspacewindow), each
with its own tracked-components map. The `hover-link` subscription itself
stays a single, one-time registration. It's a `Workspace`-level event, not
tied to any one document, so it fires regardless of which window the hover
happened in.

## Shared building blocks

### `NotebookEmbedChild`

`NotebookEmbedChild` (`embed-notebooks-shared.ts`) is the piece both
reading mode and Live Preview mount into their respective containers. It
extends `MarkdownRenderChild` and renders one of three states based on
`JupyterEnvironment`'s status, re-rendering whenever
`JupyterEnvironmentEvent.CHANGE` fires (the server starting or stopping):

| State | What's shown |
|---|---|
| `RUNNING` | A `<webview>` loading the notebook from the Jupyter server. Height is configurable via settings (default 500px). No title bar (the webview's own interface already shows the filename). |
| `STARTING` | A "Jupyter is starting…" message, plus a title bar with the filename. |
| `EXITED` | A "Jupyter is not running…" message with a **Start Jupyter** button, plus a title bar. |

Each `render()` call empties the container and rebuilds it from scratch.

There was previously a more defensive version that only ever toggled
`display: none` on pre-built elements, out of concern that DOM mutations
inside a Live Preview embed might be misread by CM6 as document edits. That
turned out not to be the actual cause of an earlier, real bug (which was
replacing the *outer* `.internal-embed` node, described above). CM6 has no
reason to track the interior of a container the plugin fully owns, so
rebuilding it is safe, and simpler.

`onload()` also attaches `mousedown`/`click` listeners that stop
propagation. Without them, clicks inside the embed (the **Start Jupyter**
button, the webview) fall through to CodeMirror and move the cursor
instead of registering as a click.

### `renderJupyterMessage()`

`src/services/jupyter-message.ts` renders the centered header/text/button
layout used for the `STARTING`/`EXITED` states. Shared between
`NotebookEmbedChild` and `EmbeddedJupyterView` (`src/services/jupyter-view.ts`,
the full notebook tab). Before this was extracted, each had its own copy,
and they drifted: the embed's version had no explicit alignment or sizing,
so it inherited whatever the surrounding context happened to impose. Text
came out left-aligned in reading mode (no special ancestor) but centered in
Live Preview (nested inside Obsidian's own centered `.internal-embed`
placeholder). Centering is now explicit via the shared `jupyter-message-container`
class, so it's consistent regardless of context. (A minor, deliberate
exception remains: text size still differs slightly between reading mode
and Live Preview, since headings there pick up the active theme's
note-body sizing rather than a fixed one. Left as-is rather than
overridden, since it's small enough not to be worth flattening.)

### `forEachWorkspaceWindow()`

Both `MutationObserver`-based features initially only watched the main
window. A note opened via Obsidian's "open in new window" is a genuinely
separate `document`/`window` pair, so an observer scoped to the main
window's DOM never saw anything happening in a popout.

`forEachWorkspaceWindow()` (`src/services/workspace-windows.ts`) is a small
shared helper: given an `attach(doc, win) => cleanup` callback, it runs it
once per window (immediately for the main window, for every popout window
already open when the plugin loads, and for every one opened afterward)
and calls the matching `cleanup()` when that specific window closes (or
when its own returned `unload()` is called, for full plugin unload).

A few details worth knowing:

- **Future popouts** are caught via `workspace.on('window-open', ...)` /
  `'window-close'`. Both are public, typed API (`(win: WorkspaceWindow,
  window: Window) => any`), unlike `hover-link`.
- **Already-open popouts** at load time have no direct "list open windows"
  API, so they're found by iterating every leaf (`iterateAllLeaves()`),
  calling `leaf.getContainer()` on each (returns either the main
  `WorkspaceRoot` or a popout's `WorkspaceWindow`), and collecting the
  distinct `WorkspaceWindow` instances found via `instanceof`.
- **Cleanup on window close doesn't rely on the `MutationObserver` itself
  noticing anything.** It's not guaranteed that a `MutationObserver` fires
  individual `removedNodes` records for everything inside a window as its
  whole document is torn down. That's a different situation from a single
  node being removed from an otherwise-still-open document (e.g. an embed
  scrolling out of view), which is what the removal-tracking logic in both
  features was originally built for. Instead, both features give each
  window its own tracked-state map (created inside `attach()`, not shared
  globally), and their returned cleanup function explicitly unloads
  everything in that window's own map (tied directly to the reliable
  `window-close` event, not to whatever the observer did or didn't see).
  Without this, a `NotebookEmbedChild` or hover-preview `Component` created
  in a popout that later closed would sit in a shared map forever with
  `onunload()`/`unload()` never called, leaking its
  `JupyterEnvironmentEvent.CHANGE` listener for the life of the plugin.

## Settings

**Settings → Plugin customization → Embedded notebook height** controls the
webview height (200–2000px, default 500) used in the `RUNNING` state. It
only affects the webview; the `STARTING`/`EXITED` states are always
compact, sized to their content. Requires the note to be closed and
reopened to take effect.

## Architecture reference

| File | Role |
|---|---|
| `embed-notebooks-feature.ts` | Registers the reading-mode post-processor; wires up Live Preview and hover preview on load |
| `embed-notebooks-shared.ts` | `NotebookEmbedChild`, shared by reading mode and Live Preview |
| `embed-notebooks-live-preview.ts` | `MutationObserver`-based Live Preview embed support |
| `embed-notebooks-hover-preview.ts` | `MutationObserver`-based hover preview support |
| `embed-notebooks-settings.ts` | Settings interface, defaults, and settings UI registration |
| `src/services/jupyter-message.ts` | `renderJupyterMessage()`, shared with the full notebook tab view |
| `src/services/workspace-windows.ts` | `forEachWorkspaceWindow()`, shared by Live Preview and hover preview |

## Known limitations

- **`resolveSourcePath()`'s leaf lookup (Live Preview only, reading mode
  uses `ctx.sourcePath` directly) only checks currently open
  `markdown`-type leaves.** If a
  `.ipynb` embed ever appears somewhere that isn't one (a Canvas card,
  another plugin's custom view that renders markdown content) the lookup
  finds no owner and falls back to `workspace.getActiveFile()`, which may
  resolve a relative link against the wrong file. This only affects
  contexts outside typical note-embeds-a-notebook usage, not the main case
  this feature targets. (Hover preview doesn't have this limitation. It
  gets `sourcePath` directly from the `hover-link` event, a more reliable
  source of truth than DOM containment.)
- **Popout windows get a broader Live Preview observation scope.** No
  public equivalent to `app.workspace.containerEl` exists for a popout
  `WorkspaceWindow`, so those windows are watched at `document.body`
  instead of a narrower workspace-only root. In practice this mostly means
  slightly more DOM churn passes through the observer's cheap early-exit
  checks in a popout than in the main window, not a functional gap.
- **`MutationObserver`s carry a small always-on cost.** Unlike the
  post-processor, which only runs when Obsidian is already rendering a
  section, Live Preview's and hover preview's observers run for the
  lifetime of the plugin, and *every* DOM mutation within their observed
  scope (typing anywhere in any open note, not just something touching a
  `.ipynb` embed) passes through their callback. The cheap early-exit
  checks described above (skip leaf nodes before any subtree query, skip
  the removal scan when nothing is tracked, narrower observation roots
  where possible) keep that cost proportional to filtering, not rendering,
  but it's a real tradeoff reading mode's on-demand post-processor doesn't
  have to make.
