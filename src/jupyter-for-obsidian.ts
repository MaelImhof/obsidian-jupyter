import { FileSystemAdapter, Plugin, Tasks } from "obsidian";
import { DEFAULT_SETTINGS, Settings, SettingsProxy } from "@/settings";
import { IFeature } from "@/features/plugin-feature";
import { OpenNotebooksFeature } from "@/features/open-notebooks/open-notebooks-feature";
import { JupyterSettingsTab } from "@/settings/settings-tab";
import { JupyterEnvironment, PythonExecutableType } from "@/services/jupyter-environment";
import { CreateNotebooksFeature } from "./features/create-notebooks/create-notebooks-feature";
import { UpdateModalFeature } from "./features/update-modal/update-modal-feature";

/**
 * Main class for the Obsidian plugin that integrates Jupyter functionality.
 * 
 * Responsible for loading settings, providing access to common services
 * such as the Jupyter environment, and loading/unloading features.
 */
export default class JupyterForObsidian extends Plugin {

    /**
     * Responsible for storing settings in a reactive way.
     * Private to prevent overwriting of the instance.
     */
    private _settingsProxy: SettingsProxy<Settings> | null = null;

    /** Getter for the features to register for settings change events. */
    get settingsProxy(): SettingsProxy<Settings> {
        return this._settingsProxy!;
    }

    /** Getter for features to access and modify the settings. */
    get settings(): Settings {
        return this._settingsProxy!.settings;
    }

    /**
     * Responsible for displaying the settings interface in Obsidian.
     * Private to prevent overwriting of the instance.
     */
    private _settingsTab: JupyterSettingsTab = new JupyterSettingsTab(this.app, this);

    /** Getter for the settings tab to register settings into it. */
    get settingsTab(): JupyterSettingsTab {
        return this._settingsTab;
    }

    /**
     * The Jupyter server (or environment) used by the plugin.
     */
    public readonly env: JupyterEnvironment = new JupyterEnvironment(
            (this.app.vault.adapter as FileSystemAdapter).getBasePath(),
            DEFAULT_SETTINGS.debugConsole,
            DEFAULT_SETTINGS.pythonExecutable === PythonExecutableType.PYTHON ? "python" : DEFAULT_SETTINGS.pythonExecutablePath,
            DEFAULT_SETTINGS.jupyterTimeoutMs,
            DEFAULT_SETTINGS.jupyterEnvType,
            null,
            DEFAULT_SETTINGS.useSimpleMode
        );

    /** List of enabled features. Each feature acts as a "sub-plugin". */
    private enabledFeatures: IFeature[] = [];

    /** Called by Obsidian when it loads the plugin. */
    async onload(): Promise<void> {
        // Get the settings from the disk and proxy them for reactivity
        this._settingsProxy = new SettingsProxy<Settings>(await this.loadSettings());

        // Whenever the settings change, save them to the disk
        this.settingsProxy.on("change", async (_key, _newVal, _oldVal) => {
            await this.saveSettings(this.settings);
        });

        // Those features are the one that will be loaded afterwards and
        // actually do the work for registering commands, settings, ...
        this.enabledFeatures.push(
            new OpenNotebooksFeature(),
            new CreateNotebooksFeature(),
            new UpdateModalFeature()
        );

        // Register the settings UI for the plugin
        this.addSettingTab(this.settingsTab);

        // Load all enabled features
        this.enabledFeatures.forEach(async feature => {
            await feature.onload(this);
        });

        // Try to unload when Obsidian is closed by the user/the OS
        this.app.workspace.on('quit', async (_tasks: Tasks) => {
            this.onunload();
        });

        // Let the Jupyter environment know that the plugin has been loaded
        await this.env.endLoading();
    }

    /** Called by Obsidian when it unloads the plugin. */
    onunload(): void {
        // Kill the Jupyter Notebook process
        this.env.exit();
        this.enabledFeatures.forEach(feature => {
            feature.onunload?.();
        });
    }

    /**
     * Gets the settings saved on the disk, merging them with default values
     * if needed, and returns the complete object.
     */
    async loadSettings(): Promise<Settings> {
        return Object.assign(DEFAULT_SETTINGS, await this.loadData());
    }

    /**
     * Called by Obsidian whenever the persistent data file of the plugin
     * is modified externally (e.g., by another plugin or program).
     * 
     * This implementation reloads the settings from the disk to ensure
     * the plugin is always in sync with the latest settings.
     * 
     * It does so by setting the new values in the settings proxy,
     * ensuring events will be triggered for any changes.
     */
    async onExternalSettingsChange() {
        const settings = await this.loadSettings();
        for (const key in settings) {
            if (key in this.settings) {
                // @ts-ignore Works at runtime but TypeScript is being cautious
                this.settings[key] = settings[key];
            }
        }
    }

    /** Writes the settings to the disk for persistence. */
    async saveSettings(settings: Settings): Promise<void> {
        await this.saveData(settings);
    }
}