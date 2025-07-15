import { App, DropdownComponent, PluginSettingTab, Setting, TextComponent, ToggleComponent } from "obsidian";
import JupyterNotebookPlugin from "./jupyter-obsidian";
import { JupyterEnvironmentStatus } from "./jupyter-env";
import { JupyterRestartModal } from "./ui/jupyter-restart-modal";

export enum PythonExecutableType {
    PYTHON = "python",
    PATH = "path"
}

export interface JupyterSettings {
    deleteCheckpoints: boolean;
    moveCheckpointsToTrash: boolean;
    /**
     * Required to end with '/'. When this value is set, a check
     * is performed, and '/' is added at the end if needed.
     */
    checkpointsFolder: string;
};
export const DEFAULT_SETTINGS: JupyterSettings = {
    deleteCheckpoints: false,
    moveCheckpointsToTrash: true,
    checkpointsFolder: "",
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
    }
}