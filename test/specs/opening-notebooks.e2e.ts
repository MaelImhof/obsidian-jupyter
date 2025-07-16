import { expect } from '@wdio/globals';
import type { Browser } from 'webdriverio';
import { ObsidianBrowserCommands, obsidianPage } from 'wdio-obsidian-service';
import { getFileTreeItem, resetVaultWithSettings, TIMEOUT } from './test-utils';

declare const browser: Browser & ObsidianBrowserCommands;

describe('Opening a Jupyter notebook', async () => {
	beforeEach(async () => {
		// Ensure a completely clean vault for each test
		await browser.reloadObsidian({ vault: 'test-vault' });
		// Make sure default settings are applied
		await resetVaultWithSettings(obsidianPage, {});
	});

	it('opens an Obsidian tab and displays a webview', async () => {
		// Expect the current server status to be idle (or exited)
		const idleServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Start Jupyter Server"]'
		);
		expect(idleServerStatus).toExist();

		// Click on a Jupyter notebook to open it
		const notebook = await getFileTreeItem('Notebook creation/Valid notebook.ipynb', browser);
		await expect(notebook).toExist();
		await notebook.click();

		// Expect the server status to change to starting
		const startingServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Jupyter Server is starting"]'
		);
		await startingServerStatus.waitForExist({ timeout: TIMEOUT.SERVER_RIBBON_UPDATE });

		// Wait for a tab to open with the notebook
		const tabHeader = browser.$(
			'.workspace-tab-header.is-active[aria-label="Valid notebook.ipynb"]'
		);
		await tabHeader.waitForExist({ timeout: TIMEOUT.TAB_UPDATE });

		// Check that the notebook entry in the tree is marked as active
		expect((await notebook.getAttribute('class')).includes('is-active')).toBe(true);

		// Check that a message is being displayed while the notebook is loading
		const viewContent = browser.$('.view-content');
		expect(viewContent).toExist();
		const messageContainer = viewContent.$('.jupyter-message-container');
		await messageContainer.waitForExist({ timeout: TIMEOUT.NOTEBOOK_LOAD });

		// Expect Jupyter status to be running after a while
		const runningServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Stop Jupyter Server"]'
		);
		await runningServerStatus.waitForExist({ timeout: TIMEOUT.START_SERVER });

		// Check that the notebook content is loaded
		const jupyterWebview = browser.$('webview.jupyter-webview');
		await jupyterWebview.waitForExist({ timeout: TIMEOUT.NOTEBOOK_LOAD });

		// Check that the notebook entry in the tree is still marked as active
		expect((await notebook.getAttribute('class')).includes('is-active')).toBe(true);

		// Stop the Jupyter server
		await runningServerStatus.click();
		await idleServerStatus.waitForExist({ timeout: TIMEOUT.SERVER_RIBBON_UPDATE });

		// Check that the Jupyter webview is no longer present
		const jupyterWebviewExists = await jupyterWebview.isExisting();
		expect(jupyterWebviewExists).toBe(false);

		// Check that the notebook entry in the tree is still marked as active
		expect((await notebook.getAttribute('class')).includes('is-active')).toBe(true);
	});
});
