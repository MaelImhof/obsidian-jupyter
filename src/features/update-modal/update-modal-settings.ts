import JupyterForObsidian from '@/jupyter-for-obsidian';
import { JupyterSettingsTab, SettingsSection } from '@/settings';
import { Setting, ToggleComponent } from 'obsidian';

/**
 * Settings used by the Update Modal feature.
 */
export interface UpdateModalSettings {
	/**
	 * Whether to display a popup whenever a new version of the plugin gets
	 * installed in the vault. If set to false, the popup will not be
	 * displayed, and the user will not be notified of new versions.
	 */
	updatePopup: boolean;

	/**
	 * This persistent data is used by the plugin to keep track of which
	 * version of the plugin is currently installed.
	 *
	 * If this value does not match the runtime version of the plugin, it
	 * means an update has been installed, and the plugin will
	 * display the update modal.
	 *
	 * This setting is not meant to be modified by the user, but simply
	 * to be used as persistent data to keep track of the plugin's
	 * current version.
	 *
	 * An empty string means the plugin just got installed, and the
	 * update modal will not be displayed.
	 */
	knownVersion: string;
}

/**
 * Default setting values for the Update Modal feature.
 */
export const DEFAULT_UPDATE_MODAL_SETTINGS: UpdateModalSettings = {
	updatePopup: true,
	knownVersion: ''
};

/**
 * Responsible for registering the settings UI elements for this feature.
 *
 * @param tab The settings tab to register the settings UI elements into.
 */
export function registerUpdateModalSettingsUI(tab: JupyterSettingsTab): void {
	/*=====================================================*/
	/* Plugin customization settings                       */
	/*=====================================================*/

	tab.registerSetting({
		section: SettingsSection.PLUGIN_CUSTOMIZATION,
		display: (el: HTMLElement, plugin: JupyterForObsidian) => {
			new Setting(el)
				.setName('Update popup')
				.setDesc(
					'When the plugin is updated, a popup is shown with what changes were made.'
				)
				.addToggle((toggle: ToggleComponent) => {
					toggle.setValue(plugin.settings.updatePopup).onChange((value: boolean) => {
						plugin.settings.updatePopup = value;
					});
				});
		}
	});
}
