import JupyterForObsidian from "@/jupyter-for-obsidian";
import { App, PluginSettingTab, Setting } from "obsidian";

export enum SettingsSection {
    PYTHON = "Python",
    JUPYTER = "Jupyter",
    PLUGIN_CUSTOMIZATION = "Plugin customization",
    ADVANCED = "Advanced"
}

export interface SettingUI {
    section: SettingsSection;
    display: (el: HTMLElement, plugin: JupyterForObsidian) => void;
}

/**
 * Responsible for displaying the settings interface in Obsidian.
 * 
 * Each feature is responsible for registering its own settings if they
 * need to be displayed in the settings tab. The setting can be registered
 * using the `registerSetting` method.
 */
export class JupyterSettingsTab extends PluginSettingTab {

    /** Reference to the main plugin instance. */
    private plugin: JupyterForObsidian;

    /** List of settings registered by the features. */
    private _settings: Record<SettingsSection, SettingUI[]> = Object.values(SettingsSection)
        .reduce((acc, section) => {
            acc[section as SettingsSection] = [];
            return acc;
        }, {} as Record<SettingsSection, SettingUI[]>);

    constructor(app: App, plugin: JupyterForObsidian) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /** Way for a feature to add a setting to the UI. */
    registerSetting(setting: SettingUI): void {
        this._settings[setting.section].push(setting);
    }

    display(): void {
        this.containerEl.empty();

        Object.values(SettingsSection).forEach(section => {
            const settings = this._settings[section];
            if (settings.length < 1) {
                return;
            }

            // Display a header for the section
            new Setting(this.containerEl)
                .setName(section)
                .setHeading();

            settings.forEach(setting =>
                setting.display(this.containerEl, this.plugin)
            );
        });
    }
}