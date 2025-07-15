import JupyterForObsidian from "@/jupyter-for-obsidian";
import { JupyterSettingsTab, SettingsSection } from "@/settings";
import { DropdownComponent, Setting, ToggleComponent } from "obsidian";

/**
 * Lists the ways a newly created notebook can be opened right after its
 * creation, including
 * - not opening it at all,
 * - opening it in the current tab,
 * - opening it in a new tab,
 * - opening it in a split tab,
 * - opening it in a new window.
 */
export enum OpenCreatedNotebook {
    /** The notebook is created but not opened at all. */
    DONT = "dont-open",

    /**
     * The notebook is opened in the current tab. This is the default
     * behavior in vanilla Obsidian. It will replace the currently active
     * document, or open a new tab if the currently active document
     * is pinned.
     */
    CURRENT_TAB = "current-tab",

    /**
     * The notebook will be opened in a new tab, whether the current tab
     * is pinned or not.
     */
    NEW_TAB = "new-tab",

    /**
     * The notebook will be opened in a new split tab, which will
     * be created next to the current tab.
     */
    SPLIT = "split",

    /** The notebook will be opened in a new window. */
    WINDOW = "detached-window"
}

/**
 * Settings used by the Create Notebooks feature.
 */
export interface CreateNotebooksSettings {
    /**
     * Whether to display a ribbon icon to create a new Jupyter notebook.
     * 
     * This is purely for customization purposes, allowing the user to
     * hide the ribbon icon if they do not want it to be displayed.
     */
    displayFileRibbonIcon: boolean;

    /**
     * Whether to display a context menu item to create a new Jupyter
     * notebook when right-clicking on a folder in the file explorer.
     */
    displayFolderContextMenuItem: boolean;

    /**
     * The mode in which a newly created notebook will be opened.
     * 
     * See {@link OpenCreatedNotebook} for the list of possible
     */
    openCreatedFileMode: OpenCreatedNotebook;
}

/**
 * Default setting values for the Create Notebooks feature.
 */
export const DEFAULT_CREATE_NOTEBOOKS_SETTINGS: CreateNotebooksSettings = {
    displayFileRibbonIcon: true,
    displayFolderContextMenuItem: true,
    openCreatedFileMode: OpenCreatedNotebook.CURRENT_TAB
};

/**
 * Responsible for registering the settings UI elements for this feature.
 * 
 * @param tab The settings tab to register the settings UI elements into.
 */
export function registerCreateNotebooksSettingsUI(tab: JupyterSettingsTab): void {
    
    /*=====================================================*/
	/* Plugin customization settings                       */
	/*=====================================================*/

    tab.registerSetting({
        section: SettingsSection.PLUGIN_CUSTOMIZATION,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Ribbon icon for new notebooks")
                .setDesc("Whether to display a ribbon icon that creates a blank Jupyter notebook when clicked.")
                .addToggle((toggle: ToggleComponent) =>
                    toggle
                        .setValue(plugin.settings.displayFileRibbonIcon)
                        .onChange((value: boolean) => {
                            plugin.settings.displayFileRibbonIcon = value;
                        })
                );
        }
    });

    tab.registerSetting({
        section: SettingsSection.PLUGIN_CUSTOMIZATION,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Folder context menu for new notebooks")
                .setDesc("If enabled, when you right-click on a folder, one of the actions will be to create a new Jupyter notebook in that folder.")
                .addToggle((toggle: ToggleComponent) =>
                    toggle
                        .setValue(plugin.settings.displayFolderContextMenuItem)
                        .onChange((value: boolean) => {
                            plugin.settings.displayFolderContextMenuItem = value;
                        })
                );
        }
    });

    tab.registerSetting({
        section: SettingsSection.PLUGIN_CUSTOMIZATION,
        display: (el: HTMLElement, plugin: JupyterForObsidian) => {
            new Setting(el)
                .setName("Open created notebooks")
                .setDesc("Whether to open a notebook directly when it is created, and how to open it.")
                .addDropdown((dropdown: DropdownComponent) => {
                    dropdown
                        .addOption(OpenCreatedNotebook.DONT, "Do not open")
                        .addOption(OpenCreatedNotebook.CURRENT_TAB, "Open in the current tab (default)")
                        .addOption(OpenCreatedNotebook.NEW_TAB, "Open in a new tab")
                        .addOption(OpenCreatedNotebook.SPLIT, "Open in a new split tab")
                        .addOption(OpenCreatedNotebook.WINDOW, "Open in a detached window")
                        .setValue(plugin.settings.openCreatedFileMode)
                        .onChange((value: OpenCreatedNotebook) => {
                            plugin.settings.openCreatedFileMode = value;
                        });
                });
        }
    });
}