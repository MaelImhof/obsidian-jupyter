import JupyterForObsidian from '@/jupyter-for-obsidian';
import { IFeature } from '../plugin-feature';
import {
	addIcon,
	Menu,
	MenuItem,
	Notice,
	PaneType,
	TAbstractFile,
	TFile,
	TFolder,
	WorkspaceLeaf
} from 'obsidian';
import {
	OpenCreatedNotebook,
	registerCreateNotebooksSettingsUI
} from './create-notebooks-settings';
import { JupyterAbstractPath } from '@/services/jupyter-path';

/**
 * Feature that allows the user to create new Jupyter notebooks
 * from the Obsidian UI in different ways :
 *
 * - By clicking on a ribbon icon
 * - By right-clicking on a folder in the file explorer
 * - By using a command in the command palette
 */
export class CreateNotebooksFeature implements IFeature {
	private plugin: JupyterForObsidian;

	/**
	 * The ribbon icon used to create Jupyter notebooks.
	 *
	 * Since the user can show/hide the ribbon icon in the settings, a
	 * reference to the icon is kept here so that it can be removed
	 * later if needed.
	 */
	private fileRibbonIcon: HTMLElement | null = null;

	/**
	 * Handler that gets called by Obsidian when the user right-clicks a
	 * file or folder in the file explorer.
	 *
	 * Used to display a context menu item to create a new Jupyter notebook
	 * in the folder that was right-clicked.
	 *
	 * Kept as a class property so that it can be removed later
	 * if the user disables the context menu item in the settings.
	 */
	private onFileContextMenu = this.onFileContextMenuOpened.bind(this);

	async onload(plugin: JupyterForObsidian): Promise<void> {
		this.plugin = plugin;

		// Register this feature's settings to be displayed in the UI
		registerCreateNotebooksSettingsUI(this.plugin.settingsTab);

		/*
		 * Adding the Jupyter logo as a custom icon in Obsidian.
		 *
		 * The icon used is derived from `coreui`'s Jupyter SVG Vector icon :
		 * https://www.svgrepo.com/svg/341956/jupyter
		 *
		 * It was adjusted to be a custom icon in Obsidian :
		 * - Removed the surrounding SVG tags
		 * - Resized to fit a viewBox of "0 0 100 100"
		 * - Added the fill="currentColor" property to adapt to Obsidian's theme
		 * For more information about those modifications, see Obsidian's documentation :
		 * https://docs.obsidian.md/Plugins/User+interface/Icons#Add+your+own+icon
		 *
		 * Provided under the terms of the GPL license :
		 * https://www.svgrepo.com/page/licensing/#GPL
		 */
		addIcon(
			'jupyter-logo',
			`<path fill="currentColor" d="m 51.4537,74.98344 c -15.406714,0 -29.180954,-5.68784 -36.479994,-13.79248 2.83328,7.29904 7.71248,13.79248 14.187674,18.24 6.493446,4.46576 14.187686,6.8856 22.29232,6.8856 8.10464,0 15.82016,-2.41984 22.29232,-6.8856 C 80.239467,74.98344 85.100427,68.49 87.933707,61.19096 80.634667,69.29864 66.86042,74.98344 51.4537,74.98344 Z m 0,-53.5192 c 15.40672,0 29.180967,5.68784 36.480007,13.79248 -2.83328,-7.29904 -7.69424,-13.79248 -14.187687,-18.24 -6.8856,-4.86096 -14.57984,-7.29904 -22.29232,-7.29904 -8.107674,0 -15.798874,2.44112 -22.29232,6.8856 C 22.689226,21.46424 17.806986,27.54424 14.973706,35.25672 22.272746,26.7356 35.654826,21.46424 51.4537,21.46424 Z M 79.829067,2.02344 c -7.566567,0 -7.566567,11.33312 0,11.33312 7.56656,0 7.56656,-11.33312 0,-11.33312 z M 22.689226,83.89672 c -4.04016,0 -7.299046,3.25888 -7.299046,7.29904 0,4.02192 3.258886,7.2808 7.299046,7.2808 4.021914,0 7.280794,-3.25888 7.280794,-7.2808 0,-4.04016 -3.258874,-7.29904 -7.280794,-7.29904 z m -6.08,-72.96 c -5.414243,0 -5.414243,8.10768 0,8.10768 5.399034,0 5.399034,-8.10768 0,-8.10768 z" id="path1" style="stroke-width:3.04" />`
		);

		// Register a ribbon icon (or not if disabled) to create notebooks
		if (this.plugin.settings.displayFileRibbonIcon) {
			this.fileRibbonIcon = this.plugin.addRibbonIcon(
				'jupyter-logo',
				'Create Jupyter Notebook',
				this.onFileRibbonIconClicked.bind(this)
			);
		}
		this.plugin.settingsProxy.on('change:displayFileRibbonIcon', (newVal, _oldVal) => {
			if (newVal) {
				this.fileRibbonIcon = this.plugin.addRibbonIcon(
					'jupyter-logo',
					'Create Jupyter Notebook',
					this.onFileRibbonIconClicked.bind(this)
				);
			} else {
				this.fileRibbonIcon?.remove();
				this.fileRibbonIcon = null;
			}
		});

		// Register a context menu item (or not if disabled) to create notebooks
		if (this.plugin.settings.displayFolderContextMenuItem) {
			this.plugin.app.workspace.on('file-menu', this.onFileContextMenu);
		}
		this.plugin.settingsProxy.on('change:displayFolderContextMenuItem', (newVal, _oldVal) => {
			if (newVal) {
				this.plugin.app.workspace.on('file-menu', this.onFileContextMenu);
			} else {
				this.plugin.app.workspace.off('file-menu', this.onFileContextMenu);
			}
		});

		// Allow the user to create a new Jupyter notebook with an Obsidian
		// command from the command palette
		this.plugin.addCommand({
			id: 'jupyter-create-notebook',
			name: 'Create new Jupyter notebook',
			callback: (async () => {
				// Create a new Jupyter notebook in the root of the vault
				await this.createJupyterNotebook(
					JupyterAbstractPath.fromRelative('/', true, this.plugin.app.vault)
				);
			}).bind(this)
		});
	}

	/** Event handler for when the ribbon icon is clicked. */
	private async onFileRibbonIconClicked() {
		await this.createJupyterNotebook(
			JupyterAbstractPath.fromRelative('/', true, this.plugin.app.vault)
		);
	}

	/** Triggered by Obsidian when the user right clicks a file or folder. */
	private onFileContextMenuOpened(
		menu: Menu,
		file: TAbstractFile,
		_source: string,
		_leaf?: WorkspaceLeaf
	): void {
		// Only propose to create a Jupyter Notebook in folders
		if (file instanceof TFolder) {
			menu.addItem((item: MenuItem) => {
				item.setTitle('New Jupyter notebook')
					.setIcon('jupyter-logo')
					.setSection('action-primary')
					.onClick(async (_event: MouseEvent | KeyboardEvent) => {
						await this.createJupyterNotebook(
							JupyterAbstractPath.fromRelative(file.path, true, this.plugin.app.vault)
						);
					});
			});
		}
	}

	/** Creates a new Jupyter notebook in the specified folder. */
	private async createJupyterNotebook(folder: JupyterAbstractPath) {
		// Check that the notebook is being created inside of the Obsidian vault
		if (!folder.inVault()) {
			throw new Error('Creating a new notebook can only be done within the vault.');
		}

		// Append the filename to the folder name
		const file = folder.append(this.getDefaultNotebookFilename(), false);

		// Check that the file does not already exist to avoid overwriting it
		if (await this.plugin.app.vault.adapter.exists(file.getRelativePath() as string)) {
			new Notice(
				`The file "${file.getRelativePath() as string}" already exists, creation was aborted to avoid overwriting it. Please try again.`
			);
		}

		// Create a Jupyter notebook with the minimum amount of content
		await this.plugin.app.vault.adapter.write(
			file.getRelativePath() as string,
			`{"cells": [],"metadata": {"kernelspec": {"display_name": "","name": ""},"language_info": {"name": ""}},"nbformat": 4,"nbformat_minor": 5}`
		);

		// Depending on the corresponding setting, open the created notebook
		if (this.plugin.settings.openCreatedFileMode !== OpenCreatedNotebook.DONT) {
			let newLeaf: PaneType | boolean;
			switch (this.plugin.settings.openCreatedFileMode) {
				case OpenCreatedNotebook.CURRENT_TAB:
					newLeaf = false;
					break;
				case OpenCreatedNotebook.NEW_TAB:
					newLeaf = 'tab';
					break;
				case OpenCreatedNotebook.SPLIT:
					newLeaf = 'split';
					break;
				case OpenCreatedNotebook.WINDOW:
					newLeaf = 'window';
					break;
			}
			const leaf = this.plugin.app.workspace.getLeaf(newLeaf);
			leaf.openFile(
				this.plugin.app.vault.getFileByPath(file.getRelativePath() as string) as TFile
			);
		}
	}

	/**
	 * Builds a default filename for a new Jupyter notebook using the current
	 * date and time.
	 */
	private getDefaultNotebookFilename(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		return `Jupyter Notebook ${year}-${month}-${day}-${hours}-${minutes}-${seconds}.ipynb`;
	}

	onunload(): void {
		this.plugin.app.workspace.off('file-menu', this.onFileContextMenu);
		this.fileRibbonIcon?.remove();
		this.fileRibbonIcon = null;
	}
}
