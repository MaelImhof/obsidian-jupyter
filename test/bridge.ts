/*
 * This file is the (most) shameful part of this testing setup. I could not figure out (yet)
 * how to import code from the plugin's code into the testing code, because it would create
 * errors and problems of execution.
 * 
 * So I just copy-pasted all the code I need. I'm not proud of it, but it works.
 */

export enum JupyterEnvironmentType {
    NOTEBOOK = "notebook",
    LAB = "lab"
}

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