import JupyterForObsidian from "@/jupyter-for-obsidian";

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