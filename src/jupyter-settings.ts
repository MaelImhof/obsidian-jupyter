import { App, PluginSettingTab } from "obsidian";
import JupyterNotebookPlugin from "./jupyter-obsidian";

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
    }
}