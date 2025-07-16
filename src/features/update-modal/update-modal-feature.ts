import JupyterForObsidian from "@/jupyter-for-obsidian";
import { IFeature } from "../plugin-feature";
import { registerUpdateModalSettingsUI } from "./update-modal-settings";
import { UpdateModal } from "./jupyter-update-modal";

/**
 * Feature that displays a popup message whenever the plugin
 * is updated with the changes made in the new version.
 */
export class UpdateModalFeature implements IFeature {
    private plugin: JupyterForObsidian;

    async onload(plugin: JupyterForObsidian): Promise<void> {
        this.plugin = plugin;

        // Register the settings UI for this feature
        registerUpdateModalSettingsUI(this.plugin.settingsTab);

        // Check if the plugin has been updated and display
        // a popup message if it has.
        this.announceUpdate();
    }

    /**
	 * Checks whether the plugin has been updated and displays a
	 * popup message if it has.
	 * 
	 * Strongly inspired from the QuickAdd implementation :
	 * https://github.com/chhoumann/quickadd/blob/08f269393c3cec5bf0c1d64a79d7999afd0a35a9/src/main.ts#L210
	 */
	private announceUpdate() {
		const currentVersion = this.plugin.manifest.version;
		const knownVersion = this.plugin.settings.knownVersion;

		// The version setting hasn't been set yet, the plugin has just been installed
		if (knownVersion === "") {
            this.plugin.settings.knownVersion = currentVersion;
			return;
		}

		// The current version has already been announced
		if (knownVersion === currentVersion) {
			return;
		}

		this.plugin.settings.knownVersion = currentVersion;

		if (!this.plugin.settings.updatePopup) return;

		const updateModal = new UpdateModal(this.plugin.app, this.plugin, knownVersion, currentVersion);
		updateModal.open();
	}
}