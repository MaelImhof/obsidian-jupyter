import JupyterForObsidian from '@/jupyter-for-obsidian';
import { JupyterSettingsTab, SettingsSection } from '@/settings';
import { Setting, SliderComponent } from 'obsidian';

/**
 * Settings for the embed notebooks feature.
 */
export interface EmbedNotebooksSettings {
	/** Height (in pixels) of the webview when a notebook is embedded. */
	embedHeight: number;
}

export const DEFAULT_EMBED_NOTEBOOKS_SETTINGS: EmbedNotebooksSettings = {
	embedHeight: 500
};

/**
 * Registers the embed-specific settings UI in the plugin's settings tab.
 */
export function registerEmbedNotebooksSettingsUI(tab: JupyterSettingsTab): void {
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
