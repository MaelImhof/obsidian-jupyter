import { WorkspaceWindow } from 'obsidian';
import JupyterForObsidian from '@/jupyter-for-obsidian';

/**
 * Runs `attach(doc, win)` once for the main window and once for every
 * currently-open or future popout window (Obsidian's "open in new window"),
 * and disposes of each attachment's own returned cleanup when that window
 * closes or when the returned handle's `unload()` is called.
 *
 * Popout windows are genuine separate `document`/`window` pairs. Anything
 * built around a single hardcoded `document` (a `MutationObserver`'s root,
 * for instance) silently never sees anything happening in one. This
 * exists so that per-window setup only has to be written once, shared by
 * both the live preview and hover preview embed features.
 *
 * There's no direct "list currently open windows" API, so windows already
 * open when this runs (e.g. Obsidian restored one on launch) are found by
 * iterating every leaf and checking which `WorkspaceContainer` it belongs
 * to (`leaf.getContainer()`), collecting the distinct `WorkspaceWindow`
 * instances found.
 */
export function forEachWorkspaceWindow(
	plugin: JupyterForObsidian,
	attach: (doc: Document, win: Window) => () => void
): { unload: () => void } {
	const cleanups = new Map<Document, () => void>();

	function open(doc: Document, win: Window): void {
		if (cleanups.has(doc)) return;
		cleanups.set(doc, attach(doc, win));
	}

	function close(doc: Document): void {
		cleanups.get(doc)?.();
		cleanups.delete(doc);
	}

	plugin.registerEvent(
		plugin.app.workspace.on('window-open', (workspaceWindow) => {
			open(workspaceWindow.doc, workspaceWindow.win);
		})
	);
	plugin.registerEvent(
		plugin.app.workspace.on('window-close', (workspaceWindow) => {
			close(workspaceWindow.doc);
		})
	);

	plugin.app.workspace.onLayoutReady(() => {
		open(document, window);

		plugin.app.workspace.iterateAllLeaves((leaf) => {
			const container = leaf.getContainer();
			if (container instanceof WorkspaceWindow) {
				open(container.doc, container.win);
			}
		});
	});

	return {
		unload: () => {
			for (const cleanup of cleanups.values()) {
				cleanup();
			}
			cleanups.clear();
		}
	};
}
