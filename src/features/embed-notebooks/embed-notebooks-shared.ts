import { MarkdownRenderChild, TFile } from 'obsidian';
import JupyterForObsidian from '@/jupyter-for-obsidian';
import {
	JupyterEnvironment,
	JupyterEnvironmentEvent,
	JupyterEnvironmentStatus
} from '@/services/jupyter-environment';
import { renderJupyterMessage } from '@/services/jupyter-message';

export const EMBED_CONTAINER_CLASS = 'jupyter-embed-container';
export const EMBED_CONTENT_CLASS = 'jupyter-embed-content';
export const EMBED_HAS_WEBVIEW_CLASS = 'jupyter-embed-has-webview';

/**
 * Manages the lifecycle of a single embedded notebook inside a rendered note.
 *
 * Extends `MarkdownRenderChild` so that Obsidian's renderer handles cleanup
 * (onunload) when the section is removed from the DOM. This is critical
 * because the child subscribes to Jupyter environment events — without
 * proper cleanup, listeners would leak.
 *
 * Each embed following the `![[my-notebook.ipynb]]` syntax gets its own
 * instance. The instance lives as long as the rendered section of the
 * parent note is in the DOM.
 */
export class NotebookEmbedChild extends MarkdownRenderChild {
	private changeEventListener: (env: JupyterEnvironment) => void = this.render.bind(this);

	constructor(
		containerEl: HTMLElement,
		private plugin: JupyterForObsidian,
		private file: TFile
	) {
		super(containerEl);
	}

	onload() {
		// Without this, clicks inside the embed (e.g. the "Start Jupyter"
		// button, or the webview itself) fall through to CodeMirror and
		// move the cursor instead.
		this.containerEl.addEventListener('mousedown', (e) => e.stopPropagation());
		this.containerEl.addEventListener('click', (e) => e.stopPropagation());

		// A <webview> (created by renderWebview() below) is an Electron-native
		// custom element tied to the specific window/realm it was created in.
		// Obsidian's pop-out windows are genuinely separate Window/Document
		// realms, so moving the note containing this embed to a new window
		// may leave an existing webview orphaned. render() always rebuilds
		// from scratch based on the live environment status, so it's safe
		// to call unconditionally here. A no-op for the message states,
		// and a fresh webview for the running state.
		this.containerEl.onWindowMigrated(() => this.render());

		this.plugin.env.on(JupyterEnvironmentEvent.CHANGE, this.changeEventListener);
		this.render();
	}

	onunload() {
		this.plugin.env.off(JupyterEnvironmentEvent.CHANGE, this.changeEventListener);
	}

	/**
	 * Rebuilds the embed content from scratch based on the current Jupyter
	 * environment status.
	 *
	 * Only runs on `JupyterEnvironmentEvent.CHANGE` (the server starting or
	 * stopping) plus once on load. A rare, user-triggered event, not
	 * something tied to typing or scrolling. `containerEl` here is a plain
	 * `div` this class owns. In live preview, it is nested inside Obsidian's
	 * own `.internal-embed` widget, but Obsidian only tracks that outer
	 * node's presence, not this container's interior, so rebuilding it on
	 * every render is safe.
	 */
	private render() {
		this.containerEl.empty();

		const status = this.plugin.env.getStatus();
		const showTitle = status !== JupyterEnvironmentStatus.RUNNING;

		if (showTitle) {
			const title = this.containerEl.createEl('div');
			title.addClass('embed-title', 'markdown-embed-title');
			title.innerText = this.file.name;
		}

		const content = this.containerEl.createEl('div');
		content.addClass(EMBED_CONTENT_CLASS);

		switch (status) {
			case JupyterEnvironmentStatus.RUNNING:
				content.addClass(EMBED_HAS_WEBVIEW_CLASS);
				this.renderWebview(content);
				break;
			case JupyterEnvironmentStatus.STARTING:
				renderJupyterMessage(
					content,
					'h4',
					'Jupyter is starting',
					'The Jupyter server is starting. The notebook will be displayed shortly.'
				);
				break;
			case JupyterEnvironmentStatus.EXITED:
				renderJupyterMessage(
					content,
					'h4',
					'Jupyter is not running',
					'The Jupyter server is not running. Start the server to view this notebook.',
					{
						text: 'Start Jupyter',
						onClick: () => {
							this.plugin.env.start();
						}
					}
				);
				break;
		}
	}

	/**
	 * Renders the webview loading the notebook from the running Jupyter
	 * server. Only called when the environment is RUNNING, since
	 * `getFileUrl` returns null otherwise.
	 */
	private renderWebview(container: HTMLElement): void {
		// The webview element is created using `doc.createElement` instead
		// of Obsidian's built-in `createEl`, because the latter creates the
		// element and appends it in the same call, before the webview has
		// been configured (allowpopups, partition, ...). This apparently
		// contributes to crashes when a Jupyter view switches windows (open
		// in new window).
		//
		// The webview is fully configured before being attached to the DOM
		// at all. Electron starts provisioning a `<webview>`'s guest session
		// as soon as it's connected, so `partition` has to be set before
		// that happens, not after. The previous code created-and-attached in
		// one step via `createEl`, then set `partition` afterwards, which
		// still loaded content fine for ordinary use, but reliably crashed
		// Obsidian outright when the leaf was later moved to a pop-out
		// window.
		// @ts-ignore — "webview" is an Electron element, not a standard HTML tag
		const webview = container.doc.createElement('webview');
		webview.setAttribute('allowpopups', '');
		// @ts-ignore — this.plugin.app.appId is undocumented, but a genuine
		// Obsidian property (confirmed via the core Web Viewer plugin's own
		// webview).
		webview.setAttribute('partition', 'persist:vault-' + this.plugin.app.appId);
		webview.addClass('jupyter-webview');
		webview.style.height = this.plugin.settings.embedHeight + 'px';
		container.appendChild(webview);
		webview.setAttribute('src', this.plugin.env.getFileUrl(this.file.path) as string);
	}
}
