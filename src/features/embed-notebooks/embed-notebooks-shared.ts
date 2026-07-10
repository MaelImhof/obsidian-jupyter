import { ButtonComponent, MarkdownRenderChild, TFile } from 'obsidian';
import JupyterForObsidian from '@/jupyter-for-obsidian';
import {
	JupyterEnvironment,
	JupyterEnvironmentEvent,
	JupyterEnvironmentStatus
} from '@/services/jupyter-environment';

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

	/**
	 * Pre-created content containers for each Jupyter environment state.
	 *
	 * Created once in onload() and toggled via display:none on each
	 * render() call. Avoids DOM mutations (appendChild/removeChild)
	 * inside the CodeMirror content area, which would be detected by CM6
	 * as source content changes and written back to the file.
	 */
	private titleEl!: HTMLElement;
	private contentEl!: HTMLElement;
	private exitedEl!: HTMLElement;
	private startingEl!: HTMLElement;
	private runningEl!: HTMLElement;
	private webviewEl!: HTMLElement;

	private initialized = false;

	constructor(
		containerEl: HTMLElement,
		private plugin: JupyterForObsidian,
		private file: TFile
	) {
		super(containerEl);
	}

	onload() {
		this.initContent();
		this.plugin.env.on(JupyterEnvironmentEvent.CHANGE, this.changeEventListener);
		this.render();
	}

	onunload() {
		this.plugin.env.off(JupyterEnvironmentEvent.CHANGE, this.changeEventListener);
	}

	/**
	 * Creates all content elements once. Individual state panels are
	 * hidden by default and toggled by render().
	 */
	private initContent(): void {
		if (this.initialized) return;
		this.initialized = true;

		this.containerEl.addEventListener('mousedown', (e) => e.stopPropagation());
		this.containerEl.addEventListener('click', (e) => e.stopPropagation());

		this.titleEl = this.containerEl.createEl('div');
		this.titleEl.addClass('embed-title', 'markdown-embed-title');
		this.titleEl.innerText = this.file.name;

		this.contentEl = this.containerEl.createEl('div');
		this.contentEl.addClass(EMBED_CONTENT_CLASS);

		// Starting state
		this.startingEl = this.contentEl.createEl('div');
		const startingHeader = this.startingEl.createEl('h4');
		startingHeader.addClass('jupyter-embed-message-header');
		startingHeader.setText('Jupyter is starting');
		const startingText = this.startingEl.createEl('p');
		startingText.addClass('jupyter-embed-message-text');
		startingText.setText(
			'The Jupyter server is starting. The notebook will be displayed shortly.'
		);

		// Exited state
		this.exitedEl = this.contentEl.createEl('div');
		const exitedHeader = this.exitedEl.createEl('h4');
		exitedHeader.addClass('jupyter-embed-message-header');
		exitedHeader.setText('Jupyter is not running');
		const exitedText = this.exitedEl.createEl('p');
		exitedText.addClass('jupyter-embed-message-text');
		exitedText.setText(
			'The Jupyter server is not running. Start the server to view this notebook.'
		);
		const startButton = new ButtonComponent(this.exitedEl);
		startButton.setButtonText('Start Jupyter');
		startButton.onClick(() => {
			this.plugin.env.start();
		});

		// Running state
		this.runningEl = this.contentEl.createEl('div');
		this.runningEl.addClass(EMBED_HAS_WEBVIEW_CLASS);
		// @ts-ignore — "webview" is an Electron element, not a standard HTML tag
		this.webviewEl = this.runningEl.createEl('webview');
		this.webviewEl.setAttribute('allowpopups', '');
		// @ts-ignore — appId is a property injected by the Surfing plugin
		this.webviewEl.setAttribute('partition', 'persist:surfing-vault-' + this.plugin.app.appId);
		this.webviewEl.addClass('jupyter-webview');
		this.webviewEl.style.height = this.plugin.settings.embedHeight + 'px';
	}

	/**
	 * Shows or hides content panels based on the current Jupyter state.
	 *
	 * Only toggles pre-existing elements via display:none — never adds
	 * or removes DOM nodes. This prevents CodeMirror from interpreting
	 * structural DOM changes as edits to the source document.
	 *
	 * The webview `src` is set here (not in initContent) so that
	 * getFileUrl is only called when Jupyter is actually running —
	 * it returns null if the server isn't ready yet.
	 *
	 * TODO: Would it be better to simply add/remove elements? After the latest debugging steps, not sure the DOM mutations were actually the cause of the CM6 issues.
	 */
	private render() {
		const status = this.plugin.env.getStatus();

		this.titleEl.toggle(status !== JupyterEnvironmentStatus.RUNNING);
		this.startingEl.toggle(status === JupyterEnvironmentStatus.STARTING);
		this.exitedEl.toggle(status === JupyterEnvironmentStatus.EXITED);

		const isRunning = status === JupyterEnvironmentStatus.RUNNING;
		this.runningEl.toggle(isRunning);
		if (isRunning) {
			this.webviewEl.setAttribute(
				'src',
				this.plugin.env.getFileUrl(this.file.path) as string
			);
		}
	}
}
