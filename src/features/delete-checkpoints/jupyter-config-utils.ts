import JupyterForObsidian from '@/jupyter-for-obsidian';
import { JupyterAbstractPath } from '@/services/jupyter-path';
import { getPluginFolder } from '@/services/path-utils';
import { normalizePath } from 'obsidian';
import { getCheckpointsRootFolder } from './jupyter-checkpoints-utils';

/**
 * Provide the path to the custom Jupyter config file ('jupyter_lab_config.py'). This
 * configuration is used to tell Jupyter where to put checkpoints if the user has enabled
 * auto-deletion of checkpoints.
 */
export function getJupyterConfigPath(plugin: JupyterForObsidian): JupyterAbstractPath {
	const pluginFolder: JupyterAbstractPath = getPluginFolder(plugin);
	return pluginFolder.append('jupyter_lab_config.py', false);
}

/**
 * Indicates whether the Jupyter configuration file exists (true) or
 * needs to be created (false).
 */
export async function customJupyterConfigExists(plugin: JupyterForObsidian): Promise<boolean> {
	// Find out the path to the Jupyter configuration file
	let configPath: JupyterAbstractPath;
	try {
		configPath = getJupyterConfigPath(plugin);
	} catch (e) {
		return false;
	}

	// Check for the config to be in the vault
	if (!configPath.inVault()) {
		return false;
	}

	// Check if the file exists
	// We know configPath.getRelativePath() is not null because we checked for the config to be in the vault
	return await plugin.app.vault.adapter.exists(
		normalizePath(configPath.getRelativePath() as string)
	);
}

/**
 * Generates a Jupyter configuration file in the folder indicated by
 * {@link getJupyterConfigPath} with settings to put all checkpoints
 * in a single folder.
 */
export async function generateJupyterConfig(plugin: JupyterForObsidian): Promise<boolean> {
	// Find out the path to the Jupyter configuration file
	// Find where the checkpoints will have to be stored to then tell Jupyter
	let checkpointsFolder: JupyterAbstractPath;
	let configPath: JupyterAbstractPath;
	try {
		checkpointsFolder = getCheckpointsRootFolder(plugin);
		configPath = getJupyterConfigPath(plugin);
	} catch (e) {
		return false;
	}

	// The configuration file must be within the vault in order to use the vault's adapter
	if (!configPath.inVault()) {
		return false;
	}

	// Prepare the content to put into the configuration file
	const configContent = `c.FileContentsManager.checkpoints_kwargs = {'root_dir': r'${checkpointsFolder.getAbsolutePath()}'}
print("[Jupyter for Obsidian] Custom configuration of Jupyter for Obsidian loaded successfully.")`;

	// Write the config to the file
	// We know configPath.getRelativePath() is not null because we checked it is in the vault above
	await plugin.app.vault.adapter.write(
		normalizePath(configPath.getRelativePath() as string),
		configContent
	);
	return true;
}

/**
 * If the custom Jupyter configuration file used by the Jupyter for Obsidian
 * plugin exists, it deletes it.
 */
export async function deleteJupyterConfig(plugin: JupyterForObsidian) {
	// Find out the path to the Jupyter configuration file
	let configPath: JupyterAbstractPath;
	try {
		configPath = getJupyterConfigPath(plugin);
	} catch (e) {
		return;
	}

	// To use the vault adapter, the config path must be within the vault
	if (!configPath.inVault()) {
		return;
	}

	// Since we checked the config path is in the vault, it must have a relative path
	await plugin.app.vault.adapter.remove(normalizePath(configPath.getRelativePath() as string));
}
