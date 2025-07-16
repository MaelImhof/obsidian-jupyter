import { expect } from '@wdio/globals';
import type { Browser } from 'webdriverio';
import { ObsidianBrowserCommands, obsidianPage } from 'wdio-obsidian-service';
import { getFileTreeItem, resetVaultWithSettings } from './test-utils';

declare const browser: Browser & ObsidianBrowserCommands;

describe('Jupyter notebook creation', async () => {
	beforeEach(async () => {
		await resetVaultWithSettings(obsidianPage, {});
	});

	it('is available through a ribbon icon', async () => {
		// Find the ribbon icon to create a new notebook
		const createNotebookButton = browser.$(
			'.side-dock-ribbon-action[aria-label="Create Jupyter Notebook"]'
		);
		expect(createNotebookButton).toExist();

		// Create a new notebook by clicking the button
		await createNotebookButton.click();

		// Find the new notebook with a name such as "Jupyter Notebook YYYY-MM-DD-HH-mm-SS.ipynb"
		// If this plugin makes it past 2099, the test will break, but I'm not too worried about that
		const newNotebook = browser.$('.nav-file-title[data-path^="Jupyter Notebook 20"]');
		await newNotebook.waitForExist({ timeout: 5000 });

		// Expect the server status to change to starting
		const startingServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Jupyter Server is starting"]'
		);
		await startingServerStatus.waitForExist({ timeout: 5000 });
	});

	it('is available through the context menu', async () => {
		// Get the tree item of a folder
		const folder = await getFileTreeItem('Notebook creation', browser);
		expect(folder).toExist();

		// Ensure the folder is expanded by clicking it
		const parent = folder.parentElement();
		const isCollapsed = (await parent.getAttribute('class')).includes('is-collapsed');
		if (isCollapsed) {
			await folder.click();
		}

		// Right-click on the folder to open the context menu
		await folder.click({ button: 2 });

		// Find the context menu item to create a new notebook
		const contextMenuItem = browser.$(
			'.menu-item.tappable:has(> .menu-item-icon > svg.jupyter-logo)'
		);
		expect(contextMenuItem).toExist();

		// Click the context menu item to create a new notebook
		await contextMenuItem.click();

		// Find the new notebook with a name such as "Jupyter Notebook YYYY-MM-DD-HH-mm-SS.ipynb"
		const newNotebook = browser.$(
			'.nav-file-title[data-path^="Notebook creation/Jupyter Notebook 20"]'
		);
		await newNotebook.waitForExist({ timeout: 5000 });

		// Check that the new notebook is opened and Jupyter is started
		const startingServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Jupyter Server is starting"]'
		);
		await startingServerStatus.waitForExist({ timeout: 5000 });
	});

	it('is available through the command palette', async () => {
		// Create a new notebook using the command palette
		await browser.executeObsidianCommand('jupyter:jupyter-create-notebook');

		// Find the new notebook with a name such as "Jupyter Notebook YYYY-MM-DD-HH-mm-SS.ipynb"
		const newNotebook = browser.$('.nav-file-title[data-path^="Jupyter Notebook 20"]');
		await newNotebook.waitForExist({ timeout: 5000 });

		// Check that the new notebook is opened and Jupyter is started
		const startingServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Jupyter Server is starting"]'
		);
		await startingServerStatus.waitForExist({ timeout: 5000 });
	});

	it('can be removed from ribbon icons', async () => {
		await resetVaultWithSettings(obsidianPage, { displayFileRibbonIcon: false });

		// Check that the ribbon icon to create a new notebook is not present
		const createNotebookButton = browser.$(
			'.side-dock-ribbon-action[aria-label="Create Jupyter Notebook"]'
		);
		await createNotebookButton.waitForExist({ timeout: 5000, reverse: true });
	});

	it('can be removed from context menu', async () => {
		await resetVaultWithSettings(obsidianPage, { displayFolderContextMenuItem: false });

		// Get the tree item of a folder
		const folder = await getFileTreeItem('Notebook creation', browser);
		expect(folder).toExist();

		// Right-click on the folder to open the context menu
		await folder.click({ button: 2 });

		// Check that the context menu is displayed
		const newNoteContextMenuItem = browser.$(
			'.menu-item.tappable:has(> .menu-item-icon > svg.lucide-edit)'
		);
		expect(newNoteContextMenuItem).toExist();

		// Check that the context menu item to create a new notebook is not present
		const newNotebookContextMenuItem = browser.$(
			'.menu-item.tappable:has(> .menu-item-icon > svg.jupyter-logo)'
		);
		await newNotebookContextMenuItem.waitForExist({ timeout: 100, reverse: true });
	});
});
