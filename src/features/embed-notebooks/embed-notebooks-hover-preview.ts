import { Component, MarkdownRenderer, TFile } from 'obsidian';
import JupyterForObsidian from '@/jupyter-for-obsidian';
import { forEachWorkspaceWindow } from '@/services/workspace-windows';

/**
 * `hover-link` sources this feature reacts to: in-note links (reading mode
 * and Live Preview) and the file explorer. The file explorer requires
 * Ctrl/Cmd held to actually show a popover, but the event itself fires on
 * plain hover regardless (nothing renders unless a `.hover-popover`
 * actually appears, so no extra gating is needed here for that).
 */
const HOVER_SOURCES = new Set(['preview', 'editor', 'file-explorer']);

const SNIPPET_LENGTH = 200;

interface HoverLinkEvent {
	source?: string;
	linktext?: string;
	sourcePath?: string;
}

interface HoveredLink {
	linktext: string;
	sourcePath: string;
}

interface NotebookSummary {
	cellCount: number;
	/**
	 * Raw markdown source of the first markdown cell, truncated
	 * (rendered via `MarkdownRenderer`, not shown as plain text).
	 */
	snippet: string | null;
}

/**
 * Sets up hover-preview support for `.ipynb` files: links inside notes
 * (reading mode and Live Preview) and file explorer items (requires
 * Ctrl/Cmd held).
 *
 * Like Live Preview embeds, `.ipynb` popovers never go through
 * `registerMarkdownPostProcessor()`. This was confirmed empirically across
 * reading mode, Live Preview, and the file explorer, same file-type-driven
 * reason as Live Preview embeds.
 *
 * Obsidian's fallback is a `.popover.hover-popover > .file-embed.mod-generic`
 * placeholder with no `src`/`data-href` attribute to read the target file
 * from, so the target file has to come from the `hover-link` event instead,
 * correlated by timing with a `MutationObserver` watching for the popover
 * appearing.
 *
 * Unlike the Live Preview embed's `.internal-embed` node, this popover is a
 * disposable overlay (created on hover-in, destroyed on hover-out) with no
 * CM6/editor reconciliation involved, it is thus safe to empty and rebuild
 * outright.
 *
 * @see `docs/technical/embed-view.md`
 */
export function setupHoverPreview(plugin: JupyterForObsidian): { unload: () => void } {
	/**
	 * Because Jupyter notebooks are not markdown (.md) files but have their
	 * own extension, they do not get the same built-in event for handling
	 * popovers.
	 *
	 * Instead, the plugin first captures the name of the file whose link was
	 * hovered through the `hover-link` event. After which, it detects the
	 * creation of a popup using a `MutationObserver` and uses the last
	 * hovered file as likely source for the popover.
	 *
	 * `lastHover` stores the last link that was detected as hovered through
	 * `hover-link` so that `MutationObserver` can then use it as source in
	 * a later event.
	 */
	let lastHover: HoveredLink | null = null;

	/**
	 * Called by the mutation observer when a `.popover` or `.hover-popover`
	 * element is added to the DOM.
	 *
	 * @param popoverEl The container element for the popup to handle.
	 * @param trackedComponents That window's own map. Each window gets its
	 *                          own map for cleanup reasons.
	 */
	function handlePopover(
		popoverEl: HTMLElement,
		trackedComponents: Map<HTMLElement, Component>
	): void {
		if (!lastHover) return;

		// Get the likely source file (whose link is being hovered) of the
		// popover event and check it is an .ipynb file
		const src = lastHover.linktext.split('#')[0];
		if (!src.endsWith('.ipynb')) return;

		const file = plugin.app.metadataCache.getFirstLinkpathDest(src, lastHover.sourcePath);
		if (!file || !(file instanceof TFile)) return;

		void renderPreview(popoverEl, file, trackedComponents);
	}

	/**
	 * Replaces the default popover HTML with a preview specific to the
	 * Jupyter plugin and file type.
	 */
	async function renderPreview(
		popoverEl: HTMLElement,
		file: TFile,
		trackedComponents: Map<HTMLElement, Component>
	): Promise<void> {
		const summary = await summarizeNotebook(file);

		// The popover may have already been dismissed while the file was
		// being read, don't resurrect it. `isConnected` (rather than
		// `document.body.contains`) works regardless of which window's
		// document the popover actually belongs to.
		if (!popoverEl.isConnected) return;

		popoverEl.empty();
		const wrapper = popoverEl.createDiv();
		wrapper.addClass('jupyter-hover-preview');

		const title = wrapper.createDiv();
		title.addClass('jupyter-hover-preview-title');
		title.setText(file.name);

		const meta = wrapper.createEl('p');
		meta.addClass('jupyter-hover-preview-meta');
		meta.setText(summary.cellCount === 1 ? '1 cell' : `${summary.cellCount} cells`);

		if (summary.snippet) {
			const snippetEl = wrapper.createDiv();
			snippetEl.addClass('jupyter-hover-preview-snippet');

			const component = new Component();
			trackedComponents.set(popoverEl, component);
			await MarkdownRenderer.render(
				plugin.app,
				summary.snippet,
				snippetEl,
				file.path,
				component
			);

			// The popover may have been dismissed while rendering resolved.
			if (!popoverEl.isConnected) {
				component.unload();
				trackedComponents.delete(popoverEl);
			}
		}
	}

	/**
	 * Reads and summarizes the notebook directly from disk. Deliberately
	 * independent of `JupyterEnvironment`, so hovering a link never starts
	 * the server or waits on it.
	 */
	async function summarizeNotebook(file: TFile): Promise<NotebookSummary> {
		try {
			const raw = await plugin.app.vault.cachedRead(file);
			const notebook = JSON.parse(raw);
			const cells: Array<{ cell_type?: string; source?: string | string[] }> = Array.isArray(
				notebook?.cells
			)
				? notebook.cells
				: [];

			const firstMarkdownCell = cells.find((cell) => cell.cell_type === 'markdown');

			return {
				cellCount: cells.length,
				snippet: firstMarkdownCell ? toSnippet(firstMarkdownCell.source) : null
			};
		} catch {
			// Malformed/unreadable notebook. Fall back to just the title.
			return { cellCount: 0, snippet: null };
		}
	}

	/** Creates a snippet of the first markdown cell of a notebook for preview */
	function toSnippet(source: string | string[] | undefined): string | null {
		if (!source) return null;
		// TODO: Shouldn't we join with spaces here instead of the empty string?
		const text = (Array.isArray(source) ? source.join('') : source).trim();
		if (!text) return null;
		return text.length > SNIPPET_LENGTH ? text.slice(0, SNIPPET_LENGTH).trimEnd() + '…' : text;
	}

	plugin.registerEvent(
		// @ts-ignore: 'hover-link' is an undocumented event, not part of
		// Workspace's typed overloads.
		plugin.app.workspace.on('hover-link', (e: HoverLinkEvent) => {
			// Fires when the user hovers over a file link in a note
			if (!e.linktext || !HOVER_SOURCES.has(e.source ?? '')) {
				lastHover = null;
				return;
			}
			lastHover = { linktext: e.linktext, sourcePath: e.sourcePath ?? '' };
		})
	);

	// `hover-link` fires regardless of which window the hover happened in
	// (it's a Workspace-level event, not tied to any one document), so it's
	// only registered once above. The popover itself, though, is real DOM
	// in whichever window it was triggered from. A `MutationObserver` has
	// to be attached per window to see it.
	//
	// Each window also gets its own `trackedComponents` map, rather than
	// one shared globally. A window's rendered snippets need to be
	// unloaded specifically when *that* window closes (the returned
	// cleanup below), and relying on the MutationObserver to report
	// individual node removals as a whole document is torn down isn't
	// something to depend on.
	const windows = forEachWorkspaceWindow(plugin, (doc) => {
		// One Component per popover that got a rendered markdown snippet,
		// so its lifecycle (any embeds/links MarkdownRenderer registers as
		// children) is unloaded when the popover is dismissed, not just
		// left dangling.
		const trackedComponents = new Map<HTMLElement, Component>();

		/**
		 * `observer` is a reference to the `MutationObserver` used to detect
		 * popovers created or removed in the DOM.
		 *
		 * On popup creation, if it is a popup for a Jupyter notebook, it is
		 * handled and rendered properly.
		 *
		 * On popup deletion, related state is cleaned up.
		 */
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (!(node instanceof HTMLElement)) continue;
					if (!node.hasClass('popover') || !node.hasClass('hover-popover')) continue;
					handlePopover(node, trackedComponents);
				}
				for (const node of Array.from(mutation.removedNodes)) {
					if (!(node instanceof HTMLElement)) continue;
					const component = trackedComponents.get(node);
					if (!component) continue;
					component.unload();
					trackedComponents.delete(node);
				}
			}
		});

		// Popovers are appended as direct children of the window's body, so
		// no subtree traversal is needed.
		observer.observe(doc.body, { childList: true, subtree: false });

		return () => {
			observer.disconnect();
			for (const component of trackedComponents.values()) {
				component.unload();
			}
			trackedComponents.clear();
		};
	});

	return {
		unload: () => {
			windows.unload();
		}
	};
}
