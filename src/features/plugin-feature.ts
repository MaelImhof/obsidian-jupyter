import JupyterForObsidian from '@/jupyter-for-obsidian';

/**
 * The Jupyter for Obsidian plugin is organized into features.
 *
 * Each feature has its own loading and unloading logic, allowing for
 * modularity and flexibility in the plugin's functionality and
 * maintainability.
 *
 * Each of the features implements the `IFeature` interface.
 */
export interface IFeature {
	/**
	 * Called when the plugin is being loaded by Obsidian to initialize the feature.
	 *
	 * @param plugin The instance of the JupyterForObsidian plugin. Gives access to other utils such as settings, Jupyter
	 *   environment, etc.
	 */
	onload(plugin: JupyterForObsidian): Promise<void>;

	/**
	 * Called when the plugin is being unloaded by Obsidian to clean up.
	 *
	 * This method should remove any event listeners, clear intervals, or perform any other necessary cleanup.
	 *
	 * If the plugin instance is needed to perform the cleanup, it must be stored during the `onload` method.
	 */
	onunload?(): void;
}
