import { MarkdownPostProcessorContext, TFile } from 'obsidian';
import JupyterForObsidian from '@/jupyter-for-obsidian';
import { IFeature } from '@/features/plugin-feature';
import { registerEmbedNotebooksSettingsUI } from './embed-notebooks-settings';
import { EMBED_CONTAINER_CLASS, NotebookEmbedChild } from './embed-notebooks-shared';
import { setupLivePreview } from './embed-notebooks-live-preview';
import { setupHoverPreview } from './embed-notebooks-hover-preview';

/**
 * Feature that renders embedded Jupyter notebooks in other notes.
 *
 * In **reading mode**, Obsidian renders `![[some-notebook.ipynb]]` as
 * `<span class="internal-embed" src="some-notebook.ipynb">` inside the
 * rendered section element. The markdown post-processor finds those
 * elements and replaces them with live notebook previews.
 *
 * **Live preview** embeds are handled by a separate MutationObserver
 * (see `embed-notebooks-live-preview.ts`), and **hover previews** by
 * another (see `embed-notebooks-hover-preview.ts`). Both can be disabled
 * independently via settings (`enableLivePreviewEmbeds`/
 * `enableHoverPreviewEmbeds`). Each observer runs for the plugin's whole
 * lifetime, so this is an opt-out for anyone for whom that cost matters.
 * The setting change is reflected immediately, by tearing down or
 * (re-)starting the corresponding observer.
 */
export class EmbedNotebooksFeature implements IFeature {
	private plugin!: JupyterForObsidian;
	private livePreviewCleanup?: { unload: () => void };
	private hoverPreviewCleanup?: { unload: () => void };

	async onload(plugin: JupyterForObsidian): Promise<void> {
		this.plugin = plugin;

		registerEmbedNotebooksSettingsUI(plugin.settingsTab);

		this.plugin.registerMarkdownPostProcessor(
			((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				this.processReadingMode(el, ctx);
			}).bind(this)
		);

		if (plugin.settings.enableLivePreviewEmbeds) {
			this.livePreviewCleanup = setupLivePreview(plugin);
		}
		this.plugin.settingsProxy.on('change:enableLivePreviewEmbeds', (newVal) => {
			if (newVal) {
				if (!this.livePreviewCleanup) {
					this.livePreviewCleanup = setupLivePreview(plugin);
				}
			} else {
				this.livePreviewCleanup?.unload();
				this.livePreviewCleanup = undefined;
			}
		});

		if (plugin.settings.enableHoverPreviewEmbeds) {
			this.hoverPreviewCleanup = setupHoverPreview(plugin);
		}
		this.plugin.settingsProxy.on('change:enableHoverPreviewEmbeds', (newVal) => {
			if (newVal) {
				if (!this.hoverPreviewCleanup) {
					this.hoverPreviewCleanup = setupHoverPreview(plugin);
				}
			} else {
				this.hoverPreviewCleanup?.unload();
				this.hoverPreviewCleanup = undefined;
			}
		});
	}

	onunload(): void {
		this.livePreviewCleanup?.unload();
		this.hoverPreviewCleanup?.unload();
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
	 * Only handles reading mode.
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
