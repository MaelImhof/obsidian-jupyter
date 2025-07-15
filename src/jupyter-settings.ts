import { App, DropdownComponent, Notice, PluginSettingTab, Setting, SliderComponent, TextComponent, ToggleComponent } from "obsidian";
import JupyterNotebookPlugin from "./jupyter-obsidian";
import { JupyterEnvironmentStatus, JupyterEnvironmentType } from "./jupyter-env";
import { JupyterRestartModal } from "./ui/jupyter-restart-modal";

export enum PythonExecutableType {
    PYTHON = "python",
    PATH = "path"
}

export enum OpenCreatedNotebook {
    DONT = "dont-open",
    CURRENT_TAB = "current-tab",
    NEW_TAB = "new-tab",
    SPLIT = "split",
    WINDOW = "detached-window"
}

export interface JupyterSettings {
    pythonExecutable: PythonExecutableType;
    pythonExecutablePath: string;
    startJupyterAuto: boolean;
    jupyterEnvType: JupyterEnvironmentType;
    useSimpleMode: boolean;
    deleteCheckpoints: boolean;
    moveCheckpointsToTrash: boolean;
    /**
     * Required to end with '/'. When this value is set, a check
     * is performed, and '/' is added at the end if needed.
     */
    checkpointsFolder: string;
    updatePopup: boolean;
    displayServerRibbonIcon: boolean;
    useStatusNotices: boolean;
    displayFileRibbonIcon: boolean;
    displayFolderContextMenuItem: boolean;
    openCreatedFileMode: OpenCreatedNotebook,
    jupyterTimeoutMs: number;
    debugConsole: boolean;

    // These are not for the user to modify
    knownVersion: string;
};
export const DEFAULT_SETTINGS: JupyterSettings = {
    pythonExecutable: PythonExecutableType.PYTHON,
    pythonExecutablePath: "",
    startJupyterAuto: true,
    jupyterEnvType: JupyterEnvironmentType.LAB,
    useSimpleMode: true,
    deleteCheckpoints: false,
    moveCheckpointsToTrash: true,
    checkpointsFolder: "",
    updatePopup: true,
    displayServerRibbonIcon: true,
    useStatusNotices: true,
    displayFileRibbonIcon: true,
    displayFolderContextMenuItem: true,
    openCreatedFileMode: OpenCreatedNotebook.CURRENT_TAB,
    jupyterTimeoutMs: 30000,
    debugConsole: false,

    knownVersion: ""
};

export class JupyterSettingsTab extends PluginSettingTab {
    constructor(app: App, private plugin: JupyterNotebookPlugin) {
        super(app, plugin);
    }

    display() {
        this.containerEl.empty();

        /*=====================================================*/
	    /* Jupyter settings                                    */
	    /*=====================================================*/

        new Setting(this.containerEl)
            .setName("Jupyter")
            .setHeading();
        new Setting(this.containerEl)
            .setName("Delete Jupyter checkpoints")
            .setDesc("To keep your Obsidian vault clean. Does not work retroactively. Restarting Jupyter is required for the setting to take effect.")
            .addToggle(((toggle: ToggleComponent) => {
                toggle
                    .setValue(this.plugin.settings.deleteCheckpoints)
                    .onChange((async (value: boolean) => {
                        await this.plugin.setDeleteCheckpoints(value);

                        if (this.plugin.env.getStatus() !== JupyterEnvironmentStatus.EXITED) {
                            new JupyterRestartModal(this.plugin, "Delete Jupyter checkpoints").open();
                        }
                    }).bind(this))
            }).bind(this));
        new Setting(this.containerEl)
            .setName("Move Jupyter checkpoints to trash")
            .setDesc("Has no effect if 'Delete Jupyter checkpoints' is not enabled. If enabled, checkpoints are moved to system trash. Otherwise, they are permanently deleted.")
            .addToggle(((toggle: ToggleComponent) => {
                toggle
                    .setValue(this.plugin.settings.moveCheckpointsToTrash)
                    .onChange((async (value: boolean) => {
                        await this.plugin.setMoveCheckpointsToTrash(value);
                    }).bind(this))
            }).bind(this));
        new Setting(this.containerEl)
            .setName("Jupyter checkpoints folder")
            .setDesc("The root folder for all Jupyter checkpoints. Leave empty for default. Requires restarting Jupyter to take effect. Has no effect if 'Delete Jupyter checkpoints' is not enabled.")
            .addText(((text: TextComponent) => {
                text
                    .setPlaceholder(this.plugin.getDefaultCheckpointsRootFolder().getAbsolutePath() ?? "No default path available")
                    .setValue(this.plugin.settings.checkpointsFolder)
                    .onChange((async (value: string) => {
                        await this.plugin.setCheckpointsFolder(value);
                    }).bind(this));
            }).bind(this));


        /*=====================================================*/
	    /* Plugin customization settings                       */
	    /*=====================================================*/

        new Setting(this.containerEl)
            .setName("Plugin customization")
            .setHeading();
        new Setting(this.containerEl)
            .setName("Update popup")
            .setDesc("When the plugin is updated, a popup is shown with what changes were made.")
            .addToggle(((toggle: ToggleComponent) => {
                toggle
                    .setValue(this.plugin.settings.updatePopup)
                    .onChange(((value: boolean) => {
                        void this.plugin.setUpdatePopup(value);
                    }).bind(this));
            }).bind(this));
        new Setting(this.containerEl)
            .setName("Ribbon icon for new notebooks")
            .setDesc("Whether to display a ribbon icon that creates a blank Jupyter notebook when clicked.")
            .addToggle(((toggle: ToggleComponent) =>
                toggle
                    .setValue(this.plugin.settings.displayFileRibbonIcon)
                    .onChange((async (value: boolean) => {
                        await this.plugin.setFileRibbonIconSetting(value);
                    }).bind(this))
            ).bind(this));
        new Setting(this.containerEl)
            .setName("Folder context menu for new notebooks")
            .setDesc("If enabled, when you right-click on a folder, one of the actions will be to create a new Jupyter notebook in that folder.")
            .addToggle(((toggle: ToggleComponent) =>
                toggle
                    .setValue(this.plugin.settings.displayFolderContextMenuItem)
                    .onChange((async (value: boolean) => {
                        await this.plugin.setFolderContextMenuSetting(value);
                    }).bind(this))
            ).bind(this));
        new Setting(this.containerEl)
            .setName("Open created notebooks")
            .setDesc("Whether to open a notebook directly when it is created, and how to open it.")
            .addDropdown(((dropdown: DropdownComponent) => {
                dropdown
                    .addOption(OpenCreatedNotebook.DONT, "Do not open")
                    .addOption(OpenCreatedNotebook.CURRENT_TAB, "Open in the current tab (default)")
                    .addOption(OpenCreatedNotebook.NEW_TAB, "Open in a new tab")
                    .addOption(OpenCreatedNotebook.SPLIT, "Open in a new split tab")
                    .addOption(OpenCreatedNotebook.WINDOW, "Open in a detached window")
                    .setValue(this.plugin.settings.openCreatedFileMode)
                    .onChange((async (value: OpenCreatedNotebook) => {
                        await this.plugin.setOpenCreatedFileMode(value);
                    }).bind(this));
            }).bind(this));
    }
}