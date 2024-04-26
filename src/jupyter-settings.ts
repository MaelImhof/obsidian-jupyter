import { App, Notice, PluginSettingTab, Setting, ToggleComponent } from "obsidian";
import JupyterNotebookPlugin from "./jupyter-obsidian";
import { JupyterEnvironmentStatus } from "./jupyter-env";

export interface JupyterSettings {
    displayRibbonIcon: boolean;
    useStatusNotices: boolean;
    debugConsole: boolean;
    startJupyterAuto: boolean;
};
export const DEFAULT_SETTINGS: JupyterSettings = {
    displayRibbonIcon: true,
    useStatusNotices: true,
    debugConsole: false,
    startJupyterAuto: true
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
        new Setting(this.containerEl)
            .setName("Start Jupyter automatically")
            .setDesc("If a .ipynb file is opened, a Jupyter server will be started automatically if needed.")
            .addToggle(((toggle: ToggleComponent) => {
                toggle
                    .setValue(this.plugin.settings.startJupyterAuto)
                    .onChange((async (value: boolean) => {
                        this.plugin.setStartJupyterAuto(value);
                    }).bind(this))
            }).bind(this));
        new Setting(this.containerEl)
            .setName("Print Jupyter output to Obsidian console.")
            .setDesc("When you start Jupyter through a terminal, it prints a bunch of messages. You can get those messages in the Obsidian console by enabling this setting and opening the console (see key binds on the Obsidian website). This can help you if your Jupyter server does not start for some reason.")
            .addToggle(((toggle: ToggleComponent) => {
                toggle
                    .setValue(this.plugin.settings.debugConsole)
                    .onChange((async (value: boolean) => {
                        this.plugin.setDebugConsole(value);
                    }).bind(this))
            }).bind(this));
    }
}