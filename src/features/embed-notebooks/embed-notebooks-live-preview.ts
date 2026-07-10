import { MarkdownView, TFile } from 'obsidian';
import JupyterForObsidian from '@/jupyter-for-obsidian';
import { EMBED_CONTAINER_CLASS, NotebookEmbedChild } from './embed-notebooks-shared';

/**
 * Sets up live preview support for embedded `.ipynb` notebooks.
 *
 * `.ipynb` is an extension Obsidian does not support by default. As a
 * consequence, Obsidian's live preview renders Jupyter Notebook embed
 * placeholders through an internal, non-markdown code path that does not
 * invoke post-processor registered with `registerMarkdownPostProcessor`.
 * Obsidian's live preview renders `.ipynb` files' embed placeholder
 * (`.internal-embed.file-embed.mod-generic`) through an internal,
 * non-markdown code path that does not seem to invoke
 * `registerMarkdownPostProcessor`. No supported hook was found for this.
 * Even the Excalidraw plugin, which faces the same content-type problem
 * for its own non-markdown "legacy" `.excalidraw` format, live preview
 * support for it is not supported (it only supports live preview embeds for
 * its markdown-backed file format, where post-processors run normally). A
 * `MutationObserver` watching for the placeholder to appear is the only way
 * to hook in that was found. The file extension difference is the most
 * plausible explanation that was found.
 *
 * Unlike the reading mode post-processor (which uses `replaceChild`),
 * this function **keeps the `.internal-embed` element in the DOM** and
 * inserts our container as a child. Obsidian's own live preview embed
 * widget owns and tracks that outer node — replacing it breaks Obsidian's
 * internal bookkeeping for the widget. Modifying its interior is safe,
 * since Obsidian only tracks the node's presence, not its content.
 *
 * The observer watches `app.workspace.containerEl` (the whole leaf/pane
 * layout) rather than `document.body`, so it doesn't fire for churn in
 * modals, the command palette, or other non-workspace UI. It does not
 * see notes opened in popout windows (a separate `document`), which is a
 * known limitation to revisit later.
 *
 * Lifecycle of each `NotebookEmbedChild` is tracked in a Map and cleaned
 * up when the embed element is removed from the DOM (e.g., the section is
 * scrolled out of view) or when the caller invokes the returned `unload`
 * function.
 *
 * Refer to docs/technical/embed-view.md for more details about the embed
 * implementation approach.
 */
export function setupLivePreview(plugin: JupyterForObsidian): { unload: () => void } {
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				if (!(node instanceof HTMLElement)) continue;
				processNodeForEmbeds(node);
			}
			for (const node of Array.from(mutation.removedNodes)) {
				if (!(node instanceof HTMLElement)) continue;
				cleanupRemovedNode(node);
			}
		}
	});

	const trackedChildren = new Map<HTMLElement, NotebookEmbedChild>();

	/**
	 * Checks a DOM node and its descendants for unprocessed `.ipynb`
	 * embeds and processes them.
	 */
	function processNodeForEmbeds(node: HTMLElement): void {
		if (isUnprocessedIpynbEmbed(node)) {
			setupEmbed(node);
			return;
		}
		// Leaf nodes (the common case for CM6 decoration churn while
		// typing) can't contain a nested embed — skip the subtree scan.
		if (node.childElementCount === 0) return;

		Array.from(node.getElementsByClassName('internal-embed')).forEach((el) => {
			if (isUnprocessedIpynbEmbed(el)) {
				setupEmbed(el as HTMLElement);
			}
		});
	}

	/**
	 * Returns true if the element is an `.internal-embed` for an `.ipynb`
	 * file that hasn't been processed yet.
	 */
	function isUnprocessedIpynbEmbed(el: Element): boolean {
		if (!el.hasClass('internal-embed')) return false;
		if (el.getAttribute('data-jupyter-embed-processed') === 'true') return false;
		const src = el.getAttribute('src');
		if (!src) return false;
		return src.split('#')[0].endsWith('.ipynb');
	}

	/**
	 * Finds the source note that owns `embedEl`, so relative links resolve
	 * against the right file instead of guessing from the active pane.
	 *
	 * There's no `MarkdownPostProcessorContext` here — this runs from a
	 * `MutationObserver`, not a post-processor — so instead we check every
	 * open markdown leaf's DOM subtree for containment. Falls back to the
	 * active file if no leaf matches (e.g. a context not yet accounted for,
	 * such as a hover popover).
	 */
	function resolveSourcePath(embedEl: HTMLElement): string {
		const owningLeaf = plugin.app.workspace
			.getLeavesOfType('markdown')
			.find((leaf) => (leaf.view as MarkdownView).containerEl.contains(embedEl));
		const file = (owningLeaf?.view as MarkdownView | undefined)?.file;
		return file?.path ?? plugin.app.workspace.getActiveFile()?.path ?? '';
	}

	/**
	 * Creates a live notebook preview inside an `.internal-embed` element.
	 *
	 * Keeps the embed element in the DOM (it's a CM6 widget decoration) and
	 * inserts our container as a child. Sets the processed attribute to
	 * prevent double-processing.
	 */
	function setupEmbed(embed: HTMLElement): void {
		const src = embed.getAttribute('src');
		if (!src) return;

		const sourcePath = resolveSourcePath(embed);
		const file = plugin.app.metadataCache.getFirstLinkpathDest(src.split('#')[0], sourcePath);
		if (!file || !(file instanceof TFile)) return;

		embed.empty();
		embed.setAttribute('data-jupyter-embed-processed', 'true');
		embed.style.display = 'block';
		embed.style.padding = '0';
		embed.style.margin = '0';
		embed.style.border = 'none';
		embed.style.background = 'none';

		const container = embed.createEl('div');
		container.addClass(EMBED_CONTAINER_CLASS);

		const child = new NotebookEmbedChild(container, plugin, file);
		child.onload();
		trackedChildren.set(container, child);
	}

	/**
	 * Cleans up a tracked `NotebookEmbedChild` when its container is
	 * removed from the DOM.
	 *
	 * Handles two cases:
	 *   1. The removed node itself is a tracked container (direct match).
	 *   2. The removed node contains tracked containers as descendants
	 *      (e.g., a whole CodeMirror section being removed on scroll).
	 */
	function cleanupRemovedNode(node: HTMLElement): void {
		const directChild = trackedChildren.get(node);
		if (directChild) {
			directChild.onunload();
			trackedChildren.delete(node);
			return;
		}

		// Most removals are unrelated leaf nodes with nothing tracked
		// underneath — skip the scan for those.
		if (trackedChildren.size === 0 || node.childElementCount === 0) return;

		for (const [container, child] of trackedChildren) {
			if (node.contains(container)) {
				child.onunload();
				trackedChildren.delete(container);
			}
		}
	}

	// Start observing once layout is ready
	plugin.app.workspace.onLayoutReady(() => {
		const root = plugin.app.workspace.containerEl;

		observer.observe(root, {
			childList: true,
			subtree: true
		});

		// Process any existing embeds added before the observer was set up
		root.querySelectorAll('.internal-embed').forEach((el) => {
			if (isUnprocessedIpynbEmbed(el)) {
				setupEmbed(el as HTMLElement);
			}
		});
	});

	return {
		unload: () => {
			observer.disconnect();
			for (const [, child] of trackedChildren) {
				child.onunload();
			}
			trackedChildren.clear();
		}
	};
}
