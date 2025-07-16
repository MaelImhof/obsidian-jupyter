import { expect } from '@wdio/globals';
import type { Browser } from 'webdriverio';
import { ObsidianBrowserCommands, obsidianPage } from 'wdio-obsidian-service';
import { folderExists, getFileTreeItem, resetVaultWithSettings, TIMEOUT } from './test-utils';
import path from 'path';

declare const browser: Browser & ObsidianBrowserCommands;

describe.only('Jupyter checkpoints deletion', async () => {
	beforeEach(async () => {
		// Ensure a completely clean vault for each test
		await browser.reloadObsidian({ vault: 'test-vault' });
		// Make sure default settings are applied
		await resetVaultWithSettings(obsidianPage, {});
	});

	it('is disabled by default', async () => {
		// Expect the current server status to be idle (or exited)
		const idleServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Start Jupyter Server"]'
		);
		expect(idleServerStatus).toExist();

		// Click on a Jupyter notebook to open it
		const notebook = await getFileTreeItem('Checkpoints/Checkpoints.ipynb', browser);
		await expect(notebook).toExist();
		await notebook.click();

		// Check that the notebook content is loaded
		const jupyterWebview = browser.$('webview.jupyter-webview');
		await jupyterWebview.waitForExist({ timeout: TIMEOUT.START_SERVER });

		// Check that a Jupyter checkpoint folder is created
		let vaultPath = await obsidianPage.getVaultPath();
		if (!vaultPath) {
			throw new Error('Vault path is not defined');
		}
		let checkpointsFolder = path.join(vaultPath, 'Checkpoints', '.ipynb_checkpoints');
		await browser.waitUntil(
			async () => {
				// Check that the checkpoints folder was indeed created in the file system
				return await folderExists(checkpointsFolder);
			},
			{ timeout: TIMEOUT.CHECKPOINTS_FOLDER }
		);

		// Stop the Jupyter server
		const runningServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Stop Jupyter Server"]'
		);
		await runningServerStatus.click();
		await idleServerStatus.waitForExist({ timeout: TIMEOUT.SERVER_RIBBON_UPDATE });

		// Expect the Jupyter checkpoints folder to still exist
		const checkpointsFolderExists = await folderExists(checkpointsFolder);
		expect(checkpointsFolderExists).toBe(
			true,
			`Jupyter checkpoints folder should still exist after stopping the server but was removed`
		);
	});

	it('can be enabled in the settings', async () => {
		// Enable the deletion of Jupyter checkpoints in the settings
		await resetVaultWithSettings(obsidianPage, {
			deleteCheckpoints: true
		});

		// Expect the current server status to be idle (or exited)
		const idleServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Start Jupyter Server"]'
		);
		expect(idleServerStatus).toExist();

		// Click on a Jupyter notebook to open it
		const notebook = await getFileTreeItem('Checkpoints/Checkpoints.ipynb', browser);
		await expect(notebook).toExist();
		await notebook.click();

		// Check that the notebook content is loaded
		const jupyterWebview = browser.$('webview.jupyter-webview');
		await jupyterWebview.waitForExist({ timeout: TIMEOUT.START_SERVER });

		// Check that no checkpoints folder is created
		let vaultPath = await obsidianPage.getVaultPath();
		if (!vaultPath) {
			throw new Error('Vault path is not defined');
		}
		let checkpointsFolder = path.join(vaultPath, 'Checkpoints', '.ipynb_checkpoints');
		// Wait for exactly 10 seconds before performing the check
		await browser.pause(TIMEOUT.CHECKPOINTS_FOLDER);
		let checkpointsFolderExists = await folderExists(checkpointsFolder);
		expect(checkpointsFolderExists).toBe(
			false,
			`Jupyter checkpoints folder should not exist after enabling deletion but was created`
		);
	});
});
