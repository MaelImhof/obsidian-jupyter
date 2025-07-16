import JupyterForObsidian from "@/jupyter-for-obsidian";
import { JupyterAbstractPath } from "@/services/jupyter-path";
import { getPluginFolder } from "@/services/path-utils";
import { existsSync, rmdirSync } from "fs";
import { FileSystemAdapter, Notice } from "obsidian";

/**
 * Provides the default Jupyter checkpoints folder. If the user did not provide any
 * custom value, the Jupyter checkpoints will be stored in the plugin's settings directory
 * before being deleted.
 */
export function getDefaultCheckpointsRootFolder(plugin: JupyterForObsidian): JupyterAbstractPath {
	const pluginFolder: JupyterAbstractPath = getPluginFolder(plugin);
	return pluginFolder.append(".ipynb_checkpoints/", true);
}

/**
 * For the feature that gets rid of the Jupyter checkpoints, the plugin uses the Jupyter
 * configuration to put all of the checkpoints in a separate folder. This function computes
 * and returns the absolute (system) path to that folder, to pass it to Jupyter.
 * 
 * It takes both the default value and the possible user setting value into account.
 * 
 * @throws If the file adapter cannot be used to retrieve absolute paths (most probably because on mobile).
 */
export function getCheckpointsRootFolder(plugin: JupyterForObsidian): JupyterAbstractPath {
	// Check that absolute paths can be retrieved
	if (!(plugin.app.vault.adapter instanceof FileSystemAdapter)) {
		throw new Error("Invalid environment : need a file system adapter to work with files outside of the vault (Jupyter for Obsidian).");
	}
		
	// If the user setting has a value, use it
	if (plugin.settings.checkpointsFolder !== "") {
		return JupyterAbstractPath.fromAbsolute(
			plugin.settings.checkpointsFolder + ".ipynb_checkpoints",
			true,
			plugin.app.vault
		);
	}
	// Otherwise, use the default value
	else {
		// The default path is inside of the plugin's folder
		return getDefaultCheckpointsRootFolder(plugin);
	}
}

/**
 * Deletes the Jupyter checkpoints folder, either by moving it to the trash
 * or by deleting it directly, depending on the user settings.
 */
export async function purgeJupyterCheckpoints(plugin: JupyterForObsidian) {
		// Find what the folder to delete is, where the checkpoints are stored
		let checkpointsFolder: JupyterAbstractPath;
		try {
			checkpointsFolder = getCheckpointsRootFolder(plugin);
		}
		catch (e: any) {
			// The root folder of the Jupyter checkpoints cannot be found, most probably
			// because the plugin is being executed on mobile.
			return;
		}

		// Check that the folder exists
		if (!existsSync(checkpointsFolder.getAbsolutePath())) {
			return;
		}

		// If the root checkpoints folder was found, delete it
		if (!plugin.settings.deleteCheckpoints || plugin.settings.moveCheckpointsToTrash) {
			// Even if the setting is disabled, we do not want to keep the
			// special checkpoints folder around, but we move it to the bin so
			// that it is still recoverable.

			// Trashing is only possible inside of the vault for now
			if (checkpointsFolder.inVault()) {
				plugin.app.vault.adapter.trashSystem(checkpointsFolder.getRelativePath() as string);
			}
			else {
				new Notice("[Jupyter for Obsidian] ERROR\n\nMoving the Jupyter checkpoints to the " +
					"system trash is only possible when the checkpoints are stored inside of the vault.\n\n" +
					"Please consider changing either the checkpoints folder path setting to one that is inside " +
					"the vault, or define the checkpoints to be deleted without going to the trash.\n\n" +
					"Your checkpoints were not deleted nor moved to the trash.", 0);
			}
		}
		else {
			// Prefer to use the Obsidian's vault adapter where possible
			if (checkpointsFolder.inVault()) {
				plugin.app.vault.adapter.rmdir(checkpointsFolder.getRelativePath() as string, true);
			}
			else {
				rmdirSync(checkpointsFolder.getAbsolutePath(), { recursive: true });
			}
		}
	}