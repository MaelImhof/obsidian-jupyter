import { App, DropdownComponent, Notice, PluginSettingTab, Setting, SliderComponent, TextComponent, ToggleComponent } from "obsidian";
import JupyterNotebookPlugin from "./jupyter-obsidian";
import { JupyterEnvironmentStatus } from "./jupyter-env";

export enum PythonExecutableType {
    PYTHON = "python",
    PATH = "path"
}

export interface JupyterSettings {
    displayRibbonIcon: boolean;
    useStatusNotices: boolean;
    debugConsole: boolean;
    startJupyterAuto: boolean;
    closeFilesWithServer: boolean;
    pythonExecutablePath: string,
    pythonExecutable: PythonExecutableType,
    jupyterTimeoutMs: number
};
export const DEFAULT_SETTINGS: JupyterSettings = {
    displayRibbonIcon: true,
    useStatusNotices: true,
    debugConsole: false,
    startJupyterAuto: true,
    closeFilesWithServer: true,
    pythonExecutablePath: "",
    pythonExecutable: PythonExecutableType.PYTHON,
    jupyterTimeoutMs: 30000
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
                    .setValue(this.plugin.env.getStatus() !== JupyterEnvironmentStatus.EXITED)
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
                        await this.plugin.setRibbonIconSetting(value);
                    }).bind(this))
            ).bind(this));
        new Setting(this.containerEl)
            .setName("Display status notices")
            .setDesc("If enabled, short messages will pop up when the Jupyter server is starting, running or exits.")
            .addToggle(((toggle: ToggleComponent) =>
                toggle
                    .setValue(this.plugin.settings.useStatusNotices)
                    .onChange((async (value: boolean) => {
                        await this.plugin.setStatusNoticesSetting(value);
                    }).bind(this))
            ).bind(this));
        new Setting(this.containerEl)
            .setName("Start Jupyter automatically")
            .setDesc("If a .ipynb file is opened, a Jupyter server will be started automatically if needed.")
            .addToggle(((toggle: ToggleComponent) => {
                toggle
                    .setValue(this.plugin.settings.startJupyterAuto)
                    .onChange((async (value: boolean) => {
                        await this.plugin.setStartJupyterAuto(value);
                    }).bind(this))
            }).bind(this));
        new Setting(this.containerEl)
            .setName("Close files with server")
            .setDesc("If enabled, any opened .ipynb file will be closed when the Jupyter server exits.")
            .addToggle(((toggle: ToggleComponent) => {
                toggle
                    .setValue(this.plugin.settings.closeFilesWithServer)
                    .onChange((async (value: boolean) => {
                        await this.plugin.setCloseFilesWithServer(value);
                    }).bind(this))
            }).bind(this));
        new Setting(this.containerEl)
            .setName("Python executable to use")
            .setDesc("Choose whether to simply use the `python` command or a specific path. Note that you will need to restart your Jupyter server if it is running before this setting is applied.")
            .addDropdown(((dropdown: DropdownComponent) => {
                dropdown
                    .addOption(PythonExecutableType.PYTHON, "`python` command")
                    .addOption(PythonExecutableType.PATH, "Specified executable path")
                    .setValue(this.plugin.settings.pythonExecutable)
                    .onChange((async (value: PythonExecutableType) => {
                        await this.plugin.setPythonExecutable(value);
                    }).bind(this));
            }).bind(this));
        new Setting(this.containerEl)
            .setName("Python executable path")
            .setDesc("The path to the Python executable to use. This setting is only used if the previous setting is set to `Specified executable path`.")
            .addText(((text: TextComponent) => {
                text
                    .setPlaceholder("Path to Python executable")
                    .setValue(this.plugin.settings.pythonExecutablePath)
                    .onChange((async (value: string) => {
                        await this.plugin.setPythonExecutablePath(value);
                    }).bind(this));
            }).bind(this));
        new Setting(this.containerEl)
            .setName("Jupyter starting timeout")
            .setDesc("To avoid Jupyter being stuck in the starting phase, a timeout is set by default. You can set how many seconds to wait before killing the Jupyter server. Set to 0 to disable the timeout. Please note that a timeout too small might prevent Jupyter from ever starting.")
            .addSlider(((slider: SliderComponent) => {
                slider
                    .setLimits(0, 60, 1)
                    .setValue(this.plugin.settings.jupyterTimeoutMs / 1000)
                    .setDynamicTooltip()
                    .onChange((async (value: number) => {
                        await this.plugin.setJupyterTimeoutMs(value * 1000);
                    }).bind(this));
            }).bind(this));
        new Setting(this.containerEl)
            .setName("Print Jupyter output to Obsidian console.")
            .setDesc("When you start Jupyter through a terminal, it prints a bunch of messages. You can get those messages in the Obsidian console by enabling this setting and opening the console (see key binds on the Obsidian website). This can help you if your Jupyter server does not start for some reason.")
            .addToggle(((toggle: ToggleComponent) => {
                toggle
                    .setValue(this.plugin.settings.debugConsole)
                    .onChange((async (value: boolean) => {
                        await this.plugin.setDebugConsole(value);
                    }).bind(this))
            }).bind(this));
    }
}