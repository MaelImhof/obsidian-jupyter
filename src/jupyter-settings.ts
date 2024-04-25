import { App, PluginSettingTab, Setting } from "obsidian";
import JupyterNotebookPlugin from "./jupyter-obsidian";

export interface JupyterSettings { };
export const DEFAULT_SETTINGS: JupyterSettings = { };

export class JupyterSettingsTab extends PluginSettingTab {
    constructor(app: App, private plugin: JupyterNotebookPlugin) {
        super(app, plugin);
    }

    display() {
        this.containerEl.empty();

        new Setting(this.containerEl)
            .setName("Server Status")
            .setDesc("Check if the Jupyter server is running")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.env.isRunning())
                    .setDisabled(true)
            );
    }
}