import { App, Notice, PluginSettingTab, Setting, ToggleComponent } from "obsidian";
import JupyterNotebookPlugin from "./jupyter-obsidian";
import { JupyterEnvironmentStatus } from "./jupyter-env";

export interface JupyterSettings {
    displayRibbonIcon: boolean;
    useStatusNotices: boolean;
};
export const DEFAULT_SETTINGS: JupyterSettings = {
    displayRibbonIcon: true,
    useStatusNotices: true
};

export class JupyterSettingsTab extends PluginSettingTab {
    constructor(app: App, private plugin: JupyterNotebookPlugin) {
        super(app, plugin);
    }

    display() {
        this.containerEl.empty();
        
        new Setting(this.containerEl)
            .setName("Server running")
            .setDesc("Start or stop the Jupyter server.")
            .addToggle(((toggle: ToggleComponent) =>
                toggle
                    .setValue(this.plugin.env.isRunning())
                    .onChange(((value: boolean) => {
                        switch (this.plugin.env.getStatus()) {
                            case JupyterEnvironmentStatus.STARTING:
                                toggle.setValue(true);
                                new Notice("Can't change status while Jupyter server is starting.");
                                break;
                            case JupyterEnvironmentStatus.RUNNING:
                                if (!value) {
                                    this.plugin.env.exit();
                                }
                                break;
                            case JupyterEnvironmentStatus.EXITED:
                                if (value) {
                                    this.plugin.env.start();
                                }
                                break;
                        }
                    }).bind(this))
            ).bind(this));
        new Setting(this.containerEl)
            .setName("Display ribbon icon")
            .setDesc("Define whether or not you want this Jupyter plugin to use a ribbon icon.")
            .addToggle(((toggle: ToggleComponent) =>
                toggle
                    .setValue(this.plugin.settings.displayRibbonIcon)
                    .onChange((async (value: boolean) => {
                        this.plugin.setRibbonIconSetting(value);
                    }).bind(this))
            ).bind(this));
        new Setting(this.containerEl)
            .setName("Display status notices")
            .setDesc("If enabled, short messages will pop up when the Jupyter server is starting, running or exits.")
            .addToggle(((toggle: ToggleComponent) =>
                toggle
                    .setValue(this.plugin.settings.useStatusNotices)
                    .onChange((async (value: boolean) => {
                        this.plugin.setStatusNoticesSetting(value);
                    }).bind(this))
            ).bind(this));
    }
}