import JupyterForObsidian from "@/jupyter-for-obsidian";
import { JupyterEnvironmentStatus, JupyterEnvironmentType, PythonExecutableType } from "@/services/jupyter-environment";
import { JupyterRestartModal } from "@/services/jupyter-restart-modal";
import { JupyterSettingsTab, SettingsSection } from "@/settings";
import { DropdownComponent, Notice, Setting, SliderComponent, TextComponent, ToggleComponent } from "obsidian";

/**
 * Settings used by the open notebooks feature.
 */
export interface OpenNotebooksSettings {
    /**
     * Whether to use a simple `python` shell command to start Jupyter
     * or a custom Python executable path instead.
     */
    pythonExecutable: PythonExecutableType;

    /**
     * If `pythonExecutable` is set to `PATH`, this is the absolute path
     * to the Python executable to use to start Jupyter.
     */
    pythonExecutablePath: string;

    /**
     * Whether to automatically start Jupyter when a Jupyter notebook is
     * opened in Obsidian. If set to `false`, the user must manually start
     * Jupyter, and a message will be displayed in the file view in place
     * of the notebook content.
     */
    startJupyterAuto: boolean;

    /**
     * Whether to run Jupyter lab or notebook.
     */
    jupyterEnvType: JupyterEnvironmentType;

    /**
     * Whether to start Jupyter in simple interface mode. This only applies
     * if running Jupyter Lab (see `jupyterEnvType`).
     */
    useSimpleMode: boolean;

    /**
     * If set to true, a ribbon icon will be added to the Obsidian UI
     * that allows the user to keep track of the Jupyter server status and
     * start or stop it.
     */
    displayServerRibbonIcon: boolean;

    /**
     * Whether to display notices when Jupyter is starting, running,
     * or stopped.
     */
    useStatusNotices: boolean;

    /**
     * The time to wait for Jupyter to fully start before assuming it is
     * stuck or encountered an error and stopping it forcefully.
     * 
     * The Jupyter server is considered "started" when it logs the URL
     * and token to its stdout stream, allowing Jupyter for Obsidian to
     * connect to it. If this information is not logged within this amount
     * of milliseconds, the server is considered to have failed to start
     * and is shutdown forcefully.
     */
    jupyterTimeoutMs: number;

    /**
     * If set to true, everything Jupyter logs to its stdout stream
     * will be printed to the Obsidian console. Useful for debugging.
     */
    debugConsole: boolean;
}

/**
 * Default setting values for the open notebooks feature.
 */
export const DEFAULT_OPEN_NOTEBOOKS_SETTINGS: OpenNotebooksSettings = {
    pythonExecutable: PythonExecutableType.PYTHON,
    pythonExecutablePath: "",
    startJupyterAuto: true,
    jupyterEnvType: JupyterEnvironmentType.LAB,
    useSimpleMode: true,
    displayServerRibbonIcon: true,
    useStatusNotices: true,
    jupyterTimeoutMs: 60000,
    debugConsole: false
};

/**
 * Responsible for registering the settings UI elements for this feature.
 * 
 * @param tab The settings tab to register the settings UI elements into.
 */
export function registerOpenNotebookSettingsUI(tab: JupyterSettingsTab): void {

    /*=====================================================*/
	/* Python settings                                     */
	/*=====================================================*/

    tab.registerSetting({
        section: SettingsSection.PYTHON,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Python executable to use")
                .setDesc("Choose whether to simply use the `python` command or a specific path. Note that you will need to restart your Jupyter server if it is running before this setting is applied.")
                .addDropdown((dropdown: DropdownComponent) => {
                    dropdown
                        .addOption(PythonExecutableType.PYTHON, "`python` command")
                        .addOption(PythonExecutableType.PATH, "Specified executable path")
                        .setValue(plugin.settings.pythonExecutable)
                        .onChange((value: PythonExecutableType) => {
                            plugin.settings.pythonExecutable = value;
                        });
                });
        }
    });

    tab.registerSetting({
        section: SettingsSection.PYTHON,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Python executable path")
                .setDesc("The path to the Python executable to use. This setting is only used if the previous setting is set to `Specified executable path`.")
                .addText((text: TextComponent) =>
                    text
                        .setPlaceholder("Path to Python executable")
                        .setValue(plugin.settings.pythonExecutablePath)
                        .onChange((value: string) => {
                            plugin.settings.pythonExecutablePath = value;
                        })
                );
        }
    });


    /*=====================================================*/
	/* Jupyter settings                                    */
	/*=====================================================*/

    tab.registerSetting({
        section: SettingsSection.JUPYTER,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Server running")
                .setDesc("Start or stop the Jupyter server.")
                .addToggle((toggle: ToggleComponent) =>
                    toggle
                        .setValue(plugin.env.getStatus() !== JupyterEnvironmentStatus.EXITED)
                        .onChange((value: boolean) => {
                            if (plugin.env.getStatus() === JupyterEnvironmentStatus.STARTING && !value) {
                                toggle.setValue(true);
                                new Notice("Can't change status while Jupyter server is starting.");
                            }
                            else {
                                plugin.env.toggle();
                            }
                        })
                );
        }
    });

    tab.registerSetting({
        section: SettingsSection.JUPYTER,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Start Jupyter automatically")
                .setDesc("If a .ipynb file is opened, a Jupyter server will be started automatically if needed.")
                .addToggle((toggle: ToggleComponent) => {
                    toggle
                        .setValue(plugin.settings.startJupyterAuto)
                        .onChange((value: boolean) => {
                            plugin.settings.startJupyterAuto = value;
                        });
                });
        }
    });

    tab.registerSetting({
        section: SettingsSection.JUPYTER,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Jupyter environment type")
                .setDesc("Select whether to start Jupyter Notebook or Jupyter Lab.")
                .addDropdown((dropdown: DropdownComponent) => {
                    dropdown
                        .addOption(JupyterEnvironmentType.LAB, "Jupyter Lab")
                        .addOption(JupyterEnvironmentType.NOTEBOOK, "Jupyter Notebook")
                        .setValue(plugin.settings.jupyterEnvType)
                        .onChange((value: JupyterEnvironmentType) => {
                            plugin.settings.jupyterEnvType = value;
    
                            if (plugin.env.getStatus() !== JupyterEnvironmentStatus.EXITED) {
                                new JupyterRestartModal(plugin, "Jupyter environment type").open();
                            }
                        });
                });
        }
    });

    tab.registerSetting({
        section: SettingsSection.JUPYTER,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Simple interface")
                .setDesc("Whether to use Jupyter's Simple Interface mode when opening a notebook.")
                .addToggle((toggle: ToggleComponent) => {
                    toggle
                        .setValue(plugin.settings.useSimpleMode)
                        .onChange((value: boolean) => {
                            plugin.settings.useSimpleMode = value;
                        });
                });
        }
    });

    /*=====================================================*/
	/* Plugin customization settings                       */
	/*=====================================================*/

    tab.registerSetting({
        section: SettingsSection.PLUGIN_CUSTOMIZATION,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Ribbon icon for server status")
                .setDesc("Whether to display a ribbon icon that indicates the server status (exited, starting, running), which can be used to start/stop the server.")
                .addToggle((toggle: ToggleComponent) =>
                    toggle
                        .setValue(plugin.settings.displayServerRibbonIcon)
                        .onChange((value: boolean) => {
                            plugin.settings.displayServerRibbonIcon = value;
                        })
                );
        }
    });

    tab.registerSetting({
        section: SettingsSection.PLUGIN_CUSTOMIZATION,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Display status notices")
                .setDesc("If enabled, short messages will pop up when the Jupyter server is starting, running or exits.")
                .addToggle((toggle: ToggleComponent) =>
                    toggle
                        .setValue(plugin.settings.useStatusNotices)
                        .onChange((value: boolean) => {
                            plugin.settings.useStatusNotices = value;
                        })
                );
        }
    });


    /*=====================================================*/
	/* Advanced settings                                   */
	/*=====================================================*/

    tab.registerSetting({
        section: SettingsSection.ADVANCED,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Jupyter starting timeout")
                .setDesc("To avoid Jupyter being stuck in the starting phase, a timeout is set by default. You can set how many seconds to wait before killing the Jupyter server. Set to 0 to disable the timeout. Please note that a timeout too small might prevent Jupyter from ever starting.")
                .addSlider((slider: SliderComponent) => {
                    slider
                        .setLimits(0, 120, 1)
                        .setValue(plugin.settings.jupyterTimeoutMs / 1000)
                        .setDynamicTooltip()
                        .onChange((value: number) => {
                            plugin.settings.jupyterTimeoutMs = value * 1000;
                        });
                });
        }
    });

    tab.registerSetting({
        section: SettingsSection.ADVANCED,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
            .setName("Print Jupyter output to Obsidian console.")
            .setDesc("When you start Jupyter through a terminal, it prints a bunch of messages. You can get those messages in the Obsidian console by enabling this setting and opening the console (see key binds on the Obsidian website). This can help you if your Jupyter server does not start for some reason.")
            .addToggle((toggle: ToggleComponent) => {
                toggle
                    .setValue(plugin.settings.debugConsole)
                    .onChange((value: boolean) => {
                        plugin.settings.debugConsole = value;
                    });
            });
        }
    });
}
