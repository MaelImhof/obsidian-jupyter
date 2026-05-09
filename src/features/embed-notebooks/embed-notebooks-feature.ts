import {
	ButtonComponent,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	TFile
} from 'obsidian';
import JupyterForObsidian from '@/jupyter-for-obsidian';
import { IFeature } from '@/features/plugin-feature';
import {
	JupyterEnvironment,
	JupyterEnvironmentEvent,
	JupyterEnvironmentStatus
} from '@/services/jupyter-environment';
import { registerEmbedNotebooksSettingsUI } from './embed-notebooks-settings';

const EMBED_CONTAINER_CLASS = 'jupyter-embed-container';
const EMBED_CONTENT_CLASS = 'jupyter-embed-content';
const EMBED_HAS_WEBVIEW_CLASS = 'jupyter-embed-has-webview';

/**
 * Feature that enables rendering embedded Jupyter notebooks in other notes.
 *
 * When a note contains `![[some-notebook.ipynb]]`, Obsidian renders it as
 * a `<span class="internal-embed" src="some-notebook.ipynb">` in reading
 * mode. This feature's markdown post-processor finds those elements,
 * replaces them with live notebook previews, and keeps them updated as
 * the Jupyter server starts or stops.
 *
 * Refer to https://jupyter.mael.im/technical/embed-view for technical
 * details on how the embedding works under the hood.
 */
export class EmbedNotebooksFeature implements IFeature {
	private plugin!: JupyterForObsidian;

	async onload(plugin: JupyterForObsidian): Promise<void> {
		this.plugin = plugin;

		registerEmbedNotebooksSettingsUI(plugin.settingsTab);

		/*
		 * Register a markdown post-processor.
		 *
		 * This is the main Obsidian API hook for reading-mode embeds.
		 * The callback fires for each section of the rendered note, giving
		 * us the HTML element and context. We scan for .internal-embed
		 * elements, check if they reference .ipynb files, and replace
		 * them with our NotebookEmbedChild instances.
		 */
		this.plugin.registerMarkdownPostProcessor(
			((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				this.processReadingMode(el, ctx);
			}).bind(this)
		);
	}

	/**
	 * Scans a rendered section for .ipynb embeds and replaces them.
	 *
	 * Steps for each match:
	 *   1. Extract the filename from the src attribute (stripping
	 *      any `#section` fragment).
	 *   2. Resolve it to a TFile via metadataCache (handles relative
	 *      paths using ctx.sourcePath).
	 *   3. Create a container div and replace the .internal-embed
	 *      element with it.
	 *   4. Create a NotebookEmbedChild and register it with the
	 *      context so Obsidian manages its lifecycle.
	 *
	 * Only handles reading mode. Live preview and hover preview are
	 * not yet implemented.
	 */
	private processReadingMode(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
		// Find all .internal-embed elements in this section
		const embeds = Array.from(el.querySelectorAll('.internal-embed'));

		for (const embed of embeds) {
			// Only process if the src file is an .ipynb notebook
			const src = embed.getAttribute('src');
			if (!src || !src.split('#')[0].endsWith('.ipynb')) continue;

			// Try resolving the src to a TFile in the vault
			const file = this.plugin.app.metadataCache.getFirstLinkpathDest(
				src.split('#')[0],
				ctx.sourcePath
			);
			if (!file || !(file instanceof TFile)) continue;

			const container = document.createElement('div');
			container.addClass(EMBED_CONTAINER_CLASS);
			embed.parentElement?.replaceChild(container, embed);

			ctx.addChild(new NotebookEmbedChild(container, this.plugin, file));
		}
	}
}

/**
 * Manages the lifecycle of a single embedded notebook inside a rendered note.
 *
 * Extends `MarkdownRenderChild` so that Obsidian's renderer handles
 * cleanup (onunload) when the section is removed from the DOM. This is
 * critical because the child subscribes to Jupyter environment events —
 * without proper cleanup, listeners would leak.
 *
 * Each embed following the `![[my-notebook.ipynb]]` syntax gets its own
 * instance. The instance lives as long as the rendered section of the
 * parent note is in the DOM.
 */
class NotebookEmbedChild extends MarkdownRenderChild {
	private changeEventListener: (env: JupyterEnvironment) => void = this.render.bind(this);

	constructor(
		containerEl: HTMLElement,
		private plugin: JupyterForObsidian,
		private file: TFile
	) {
		super(containerEl);
	}

	/**
	 * Called by Obsidian's renderer once the child is added to the context.
	 *
	 * Subscribes to Jupyter environment status changes (started, stopped,
	 * errored, …) and re-renders whenever the status changes. This means
	 * the user sees the embed update live — if they start Jupyter from
	 * the embed's own "Start Jupyter" button, the embed switches from the
	 * "not running" message to the webview automatically.
	 */
	onload() {
		this.plugin.env.on(JupyterEnvironmentEvent.CHANGE, this.changeEventListener);
		this.render();
	}

	/**
	 * Called by Obsidian's renderer when the section is removed from the DOM.
	 *
	 * Unsubscribes from Jupyter environment events to prevent listener leaks.
	 */
	onunload() {
		this.plugin.env.off(JupyterEnvironmentEvent.CHANGE, this.changeEventListener);
	}

	/**
	 * Re-renders the entire embed content based on the current Jupyter status.
	 *
	 * The title bar is only shown when Jupyter is not running, so the user
	 * can still identify which file the placeholder belongs to. When the
	 * notebook is actually displayed, the webview already includes a title
	 * via Jupyter's interface, so we omit ours to avoid redundancy.
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
				this.renderMessage(
					content,
					'Jupyter is starting',
					'The Jupyter server is starting. The notebook will be displayed shortly.'
				);
				break;
			case JupyterEnvironmentStatus.EXITED:
				this.renderMessage(
					content,
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
	 * Renders a status message inside the embed, with an optional action button.
	 *
	 * Used for two states:
	 *   - Jupyter is starting -> informational message, no button needed
	 *   - Jupyter has exited -> message + "Start Jupyter" button
	 *
	 * @param container The container element to render the message into.
	 * @param header    The short header text of the message.
	 * @param text      The longer descriptive text of the message.
	 * @param button    Optional button config. If provided, a button will be
	 *                  rendered with the given text and click handler.
	 */
	private renderMessage(
		container: HTMLElement,
		header: string,
		text: string,
		button?: { text: string; onClick: () => void }
	) {
		const headerEl = container.createEl('h4');
		headerEl.addClass('jupyter-embed-message-header');
		headerEl.setText(header);

		const textEl = container.createEl('p');
		textEl.addClass('jupyter-embed-message-text');
		textEl.setText(text);

		if (button) {
			const buttonEl = new ButtonComponent(container);
			buttonEl.setButtonText(button.text);
			buttonEl.onClick(button.onClick);
		}
	}

	/**
	 * Renders the Jupyter notebook inside a `<webview>` element.
	 *
	 * A webview is an element that embeds a fully isolated browser window.
	 * The URL points to Jupyter's built-in file viewer (either Notebook or
	 * Lab, depending on the user's environment settings).
	 *
	 * The height is user-configurable via the plugin settings
	 * (`embedHeight`) and applied as an inline style so it takes effect
	 * immediately (after closing/reopening) without requiring CSS changes.
	 */
	private renderWebview(container: HTMLElement): void {
		// @ts-ignore — "webview" is an Electron element, not a standard HTML tag
		const webviewEl = container.createEl('webview');
		webviewEl.setAttribute('allowpopups', '');
		// @ts-ignore — appId is a property injected by the Surfing plugin
		webviewEl.setAttribute('partition', 'persist:surfing-vault-' + this.plugin.app.appId);
		webviewEl.addClass('jupyter-webview');
		webviewEl.style.height = this.plugin.settings.embedHeight + 'px';
		webviewEl.setAttribute('src', this.plugin.env.getFileUrl(this.file.path) as string);
	}
}
