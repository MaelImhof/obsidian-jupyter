import JupyterForObsidian from "@/jupyter-for-obsidian";
import { JupyterEnvironmentStatus } from "@/services/jupyter-environment";
import { JupyterAbstractPath } from "@/services/jupyter-path";
import { JupyterRestartModal } from "@/services/jupyter-restart-modal";
import { JupyterSettingsTab, SettingsSection } from "@/settings";
import { Setting, TextComponent, ToggleComponent } from "obsidian";

/**
 * Settings used by the Delete Checkpoints feature.
 */
export interface DeleteCheckpointsSettings {
    /**
     * Whether the Jupyter for Obsidian plugin should delete Jupyter
     * checkpoints automatically (basically turning the feature on/off).
     */
    deleteCheckpoints: boolean;

    /**
     * If set to true, Jupyter checkpoints will be moved to the system trash
     * instead of being permanently deleted.
     * 
     * Note that this setting has no effect if `deleteCheckpoints` is set to
     * false.
     * 
     * Also note that this setting is not supported if the Jupyter
     * checkpoints folder is set to a folder outside the vault.
     * In that case, checkpoints will always be permanently deleted.
     */
    moveCheckpointsToTrash: boolean;

    /**
     * A custom folder where Jupyter checkpoints will be stored before being
     * deleted.
     * 
     * Required to end with a `/` (slash). When this value is set, a check
     * is performed, and a `/` is added at the end if needed.
     * 
     * This has to do with how the feature is implemented. To ensure all
     * Jupyter checkpoints are deleted, the plugin will give Jupyter an
     * argument when starting it with a shell command, to tell it to place
     * all checkpoints in a specific folder instead of a subfolder of the
     * current notebook folder.
     * 
     * By default, this folder is within the Obsidian vault. However, for
     * users with auto-synchronization tools (such as Obsidian Sync,
     * Proton Drive, ...), it may be desirable to have the checkpoints
     * folder outside the vault, so that it is not synchronized
     * automatically.
     * 
     * Note that if this setting is set to a folder outside the vault,
     * checkpoints will always be permanently deleted and cannot be moved
     * to trash (not currently supported by the plugin).
     */
    checkpointsFolder: string;
}

/**
 * Default setting values for the Delete Checkpoints feature.
 */
export const DEFAULT_DELETE_CHECKPOINTS_SETTINGS: DeleteCheckpointsSettings = {
    deleteCheckpoints: true,
    moveCheckpointsToTrash: false,
    checkpointsFolder: ""
}

/**
 * Responsible for registering the settings UI elements for this feature.
 * 
 * @param tab The settings tab to register the settings UI elements into.
 * @param defaultCheckpointsRootFolder The default folder where Jupyter
 *  checkpoints will be stored before being deleted.
 */
export function registerDeleteCheckpointsSettings(
    tab: JupyterSettingsTab,
    defaultCheckpointsRootFolder: JupyterAbstractPath
): void {
    
    /*=====================================================*/
	/* Jupyter settings                                    */
	/*=====================================================*/

    tab.registerSetting({
        section: SettingsSection.JUPYTER,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Delete Jupyter checkpoints")
                .setDesc("To keep your Obsidian vault clean. Does not work retroactively. Restarting Jupyter is required for the setting to take effect.")
                .addToggle((toggle: ToggleComponent) => {
                    toggle
                        .setValue(plugin.settings.deleteCheckpoints)
                        .onChange((value: boolean) => {
                            plugin.settings.deleteCheckpoints = value;
            
                            if (plugin.env.getStatus() !== JupyterEnvironmentStatus.EXITED) {
                                new JupyterRestartModal(plugin, "Delete Jupyter checkpoints").open();
                            }
                        })
                });
        }
    });

    tab.registerSetting({
        section: SettingsSection.JUPYTER,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Move Jupyter checkpoints to trash")
                .setDesc("Has no effect if 'Delete Jupyter checkpoints' is not enabled. If enabled, checkpoints are moved to system trash. Otherwise, they are permanently deleted.")
                .addToggle((toggle: ToggleComponent) => {
                    toggle
                        .setValue(plugin.settings.moveCheckpointsToTrash)
                        .onChange((value: boolean) => {
                            plugin.settings.moveCheckpointsToTrash = value;
                        })
                });
        }
    });

    tab.registerSetting({
        section: SettingsSection.JUPYTER,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Jupyter checkpoints folder")
                .setDesc("The root folder for all Jupyter checkpoints. Leave empty for default. Requires restarting Jupyter to take effect. Has no effect if 'Delete Jupyter checkpoints' is not enabled.")
                .addText((text: TextComponent) => {
                    text
                        .setPlaceholder(defaultCheckpointsRootFolder.getAbsolutePath() ?? "No default path available")
                        .setValue(plugin.settings.checkpointsFolder)
                        .onChange((value: string) => {
                            // Ensure the value ends with a slash
                            if (value !== "" && !value.endsWith("/")) {
                                value += "/";
                            }
                            plugin.settings.checkpointsFolder = value;
                        });
                });
        }
    });
}