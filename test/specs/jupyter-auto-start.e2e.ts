import { expect } from '@wdio/globals';
import type { Browser } from 'webdriverio';
import { ObsidianBrowserCommands, obsidianPage } from 'wdio-obsidian-service';
import { getFileTreeItem, resetVaultWithSettings, TIMEOUT } from './test-utils';

declare const browser: Browser & ObsidianBrowserCommands;

describe('Jupyter auto-start', async () => {
	beforeEach(async () => {
		// Ensure a completely clean vault for each test
		await browser.reloadObsidian({ vault: 'test-vault' });
		// Make sure default settings are applied
		await resetVaultWithSettings(obsidianPage, {});
	});

	it('starts Jupyter automatically when opening a notebook', async () => {
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
	});

	it('can be disabled in settings', async () => {
		await resetVaultWithSettings(obsidianPage, { startJupyterAuto: false });

		// Expect the current server status to be idle (or exited)
		const idleServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Start Jupyter Server"]'
		);
		expect(idleServerStatus).toExist();

		// Click on a Jupyter notebook to open it
		const notebook = await getFileTreeItem('Notebook creation/Valid notebook.ipynb', browser);
		await expect(notebook).toExist();
		await notebook.click();

		// Expect the server status to remain idle
		expect(idleServerStatus).toExist();

		// Wait for a tab to open with the notebook
		const tabHeader = browser.$(
			'.workspace-tab-header.is-active[aria-label="Valid notebook.ipynb"]'
		);
		await tabHeader.waitForExist({ timeout: TIMEOUT.TAB_UPDATE });

		// Check that a message is being displayed in place of the notebook content
		const viewContent = browser.$('.view-content');
		expect(viewContent).toExist();
		const messageContainer = viewContent.$('.jupyter-message-container');
		await messageContainer.waitForExist({ timeout: TIMEOUT.NOTEBOOK_LOAD });
	});
});
