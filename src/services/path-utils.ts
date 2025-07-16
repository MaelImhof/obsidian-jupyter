import JupyterForObsidian from "@/jupyter-for-obsidian";
import { JupyterAbstractPath } from "@/services/jupyter-path";

/**
 * Obsidian plugins are installed in the Obsidian's settings folder, in their
 * own folder named after themselves.
 * 
 * This method provides the path to the folder that hosts Jupyter for Obsidian
 * and its code, settings and configuration.
 */
export function getPluginFolder(plugin: JupyterForObsidian): JupyterAbstractPath {
    return JupyterAbstractPath.fromRelative(
        plugin.app.vault.configDir + "/plugins/" + plugin.manifest.id + "/",
        true,
        plugin.app.vault
    );
}