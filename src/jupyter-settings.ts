import { App, DropdownComponent, Notice, PluginSettingTab, Setting, SliderComponent, TextComponent, ToggleComponent } from "obsidian";
import JupyterNotebookPlugin from "./jupyter-obsidian";
import { JupyterEnvironmentStatus, JupyterEnvironmentType } from "./jupyter-env";

export enum PythonExecutableType {
    PYTHON = "python",
    PATH = "path"
}

export interface JupyterSettings {
    pythonExecutable: PythonExecutableType;
    pythonExecutablePath: string;
    startJupyterAuto: boolean;
    jupyterEnvType: JupyterEnvironmentType;
    deleteCheckpoints: boolean;
    checkpointsFoldername: string;
    displayRibbonIcon: boolean;
    useStatusNotices: boolean;
    jupyterTimeoutMs: number;
    debugConsole: boolean;
};
export const DEFAULT_SETTINGS: JupyterSettings = {
    pythonExecutable: PythonExecutableType.PYTHON,
    pythonExecutablePath: "",
    startJupyterAuto: true,
    jupyterEnvType: JupyterEnvironmentType.LAB,
    deleteCheckpoints: false,
    checkpointsFoldername: ".ipynb_checkpoints",
    displayRibbonIcon: true,
    useStatusNotices: true,
    jupyterTimeoutMs: 30000,
    debugConsole: false
};

export class JupyterSettingsTab extends PluginSettingTab {
    constructor(app: App, private plugin: JupyterNotebookPlugin) {
        super(app, plugin);
    }

    display() {
        this.containerEl.empty();
        
        new Setting(this.containerEl)
            .setName("Python")
            .setHeading();
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
            .setName("Jupyter")
            .setHeading();
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
            .setName("Jupyter environment type")
            .setDesc("Select whether to start Jupyter Notebook or Jupyter Lab.")
            .addDropdown(((dropdown: DropdownComponent) => {
                dropdown
                    .addOption(JupyterEnvironmentType.LAB, "Jupyter Lab")
                    .addOption(JupyterEnvironmentType.NOTEBOOK, "Jupyter Notebook")
                    .setValue(this.plugin.settings.jupyterEnvType)
                    .onChange((async (value: JupyterEnvironmentType) => {
                        await this.plugin.setJupyterEnvType(value);
                    }).bind(this));
            }).bind(this));
        new Setting(this.containerEl)
            .setName("Delete Jupyter checkpoints")
            .setDesc("When you edit a .ipynb file, Jupyter will create a checkpoint folder in the same folder as the file and will perform regular automatic saves. One checkpoint folder per Jupyter file can become a large amount of useless files in your Vault. This option allows you to get rid of them automatically when you close the Jupyter editor.")
            .addToggle(((toggle: ToggleComponent) =>
                toggle
                    .setValue(this.plugin.settings.deleteCheckpoints)
                    .onChange((async (value: boolean) => {
                        await this.plugin.setDeleteCheckpoints(value);
                    }).bind(this))
            ).bind(this));
        new Setting(this.containerEl)
            .setName("Jupyter checkpoints folder")
            .setDesc("The name of the folder automatically generated by Jupyter. Will be used if 'Delete Jupyter checkpoints' is enabled. Indicates the name of the folder to delete.")
            .addText(((text: TextComponent) =>
                text
                    .setPlaceholder("For example '.ipynb_checkpoints'")
                    .setValue(this.plugin.settings.checkpointsFoldername)
                    .onChange((async (value: string) => {
                        await this.plugin.setCheckpointsFoldername(value);
                    }).bind(this))
            ).bind(this));

        new Setting(this.containerEl)
            .setName("Plugin customization")
            .setHeading();
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
            .setName("Advanced")
            .setHeading();
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