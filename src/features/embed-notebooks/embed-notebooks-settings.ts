import JupyterForObsidian from '@/jupyter-for-obsidian';
import { JupyterSettingsTab, SettingsSection } from '@/settings';
import { Setting, SliderComponent, ToggleComponent } from 'obsidian';

/**
 * Settings for the embed notebooks feature.
 */
export interface EmbedNotebooksSettings {
	/** Height (in pixels) of the webview when a notebook is embedded. */
	embedHeight: number;
	/**
	 * Whether embeds are detected and rendered in Live Preview. Requires a
	 * `MutationObserver` running for the plugin's whole lifetime, so this
	 * exists as an opt-out for anyone for whom performance matters. When
	 * off, a `.ipynb` embed just shows Obsidian's default placeholder.
	 */
	enableLivePreviewEmbeds: boolean;
	/**
	 * Whether hovering a `.ipynb` link shows a live preview of its content.
	 * Same performance tradeoff as `enableLivePreviewEmbeds`. When off, a
	 * hovered `.ipynb` link just shows Obsidian's default placeholder
	 * popover.
	 */
	enableHoverPreviewEmbeds: boolean;
}

export const DEFAULT_EMBED_NOTEBOOKS_SETTINGS: EmbedNotebooksSettings = {
	embedHeight: 500,
	enableLivePreviewEmbeds: true,
	enableHoverPreviewEmbeds: true
};

/**
 * Registers the embed-specific settings UI in the plugin's settings tab.
 */
export function registerEmbedNotebooksSettingsUI(tab: JupyterSettingsTab): void {
	// Live Preview embeds toggle
	tab.registerSetting({
		section: SettingsSection.PLUGIN_CUSTOMIZATION,
		display: (el: HTMLElement, plugin: JupyterForObsidian) => {
			new Setting(el)
				.setName('Live Preview embeds')
				.setDesc(
					'Show a live embed for notebooks referenced with ![[...]] while editing a note in Live Preview. Detecting these embeds requires continuously watching the editor for changes, so this can be turned off for performance in large vaults. When off, a plain placeholder is shown instead. Takes effect immediately.'
				)
				.addToggle((toggle: ToggleComponent) => {
					toggle
						.setValue(plugin.settings.enableLivePreviewEmbeds)
						.onChange((value: boolean) => {
							plugin.settings.enableLivePreviewEmbeds = value;
						});
				});
		}
	});

	// Hover preview toggle
	tab.registerSetting({
		section: SettingsSection.PLUGIN_CUSTOMIZATION,
		display: (el: HTMLElement, plugin: JupyterForObsidian) => {
			new Setting(el)
				.setName('Hover preview')
				.setDesc(
					"Show a preview of a notebook's content when hovering a link to it. Same performance tradeoff as Live Preview embeds. When off, hovering a notebook link shows Obsidian's default placeholder instead. Takes effect immediately."
				)
				.addToggle((toggle: ToggleComponent) => {
					toggle
						.setValue(plugin.settings.enableHoverPreviewEmbeds)
						.onChange((value: boolean) => {
							plugin.settings.enableHoverPreviewEmbeds = value;
						});
				});
		}
	});

	// Embed view height
	tab.registerSetting({
		section: SettingsSection.PLUGIN_CUSTOMIZATION,
		display: (el: HTMLElement, plugin: JupyterForObsidian) => {
			new Setting(el)
				.setName('Embedded notebook height')
				.setDesc(
					'The height in pixels of the embedded notebook when displayed in another note. Requires the note to be closed and reopened to take effect.'
				)
				.addSlider((slider: SliderComponent) => {
					slider
						.setLimits(200, 2000, 50)
						.setValue(plugin.settings.embedHeight)
						.setDynamicTooltip()
						.onChange((value: number) => {
							plugin.settings.embedHeight = value;
						});
				});
		}
	});
}
