import { expect } from '@wdio/globals';
import type { Browser, ChainablePromiseElement } from 'webdriverio';
import { ObsidianBrowserCommands, obsidianPage } from 'wdio-obsidian-service';
import { resetVaultWithSettings } from './test-utils';

declare const browser: Browser & ObsidianBrowserCommands;

describe('Managing Jupyter server state', async () => {
	beforeEach(async () => {
		// Reset the vault to a clean state before each test
		await resetVaultWithSettings(obsidianPage, {});
	});

	it('can be done through a ribbon icon', async () => {
		// Expect the current server status to be idle (or exited)
		const idleServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Start Jupyter Server"]'
		);
		expect(idleServerStatus).toExist();

		// Click the ribbon icon to start the Jupyter server
		await idleServerStatus.click();

		// Expect the server status to change to starting
		const startingServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Jupyter Server is starting"]'
		);
		await startingServerStatus.waitForExist({ timeout: 30000 });
		expect(idleServerStatus).not.toExist();

		// Wait for the server to be running
		const runningServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Stop Jupyter Server"]'
		);
		await runningServerStatus.waitForExist({ timeout: 30000 });
		expect(idleServerStatus).not.toExist();
		expect(startingServerStatus).not.toExist();

		// Stop the Jupyter server
		await runningServerStatus.click();

		// Expect the server status to change back to idle
		await idleServerStatus.waitForExist({ timeout: 30000 });
		expect(runningServerStatus).not.toExist();
		expect(startingServerStatus).not.toExist();
	});

	it('cannot be done when Jupyter is starting', async () => {
		// Expect the current server status to be idle (or exited)
		const idleServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Start Jupyter Server"]'
		);
		expect(idleServerStatus).toExist();

		// Click the ribbon icon to start the Jupyter server
		await idleServerStatus.click();

		// Expect the server status to change to starting
		const startingServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Jupyter Server is starting"]'
		);
		await startingServerStatus.waitForExist({ timeout: 30000 });
		expect(idleServerStatus).not.toExist();

		// Try clicking the ribbon icon again while Jupyter is starting
		await idleServerStatus.click();

		// Expect the server status to still be starting
		expect(idleServerStatus).not.toExist();
		expect(startingServerStatus).toExist();

		// Have to stop the server to reset the state for next tests
		const runningServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Stop Jupyter Server"]'
		);
		await runningServerStatus.waitForExist({ timeout: 30000 });
		await runningServerStatus.click();
		await idleServerStatus.waitForExist({ timeout: 30000 });
	});

	it('can be removed from the ribbon', async () => {
		// Set the vault's settings to remove the Jupyter server ribbon icon
		await resetVaultWithSettings(obsidianPage, { displayServerRibbonIcon: false });

		// Expect the ribbon icon to not exist
		const idleServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Start Jupyter Server"]'
		);
		const startingServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Jupyter Server is starting"]'
		);
		const runningServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Stop Jupyter Server"]'
		);
		expect(idleServerStatus).not.toExist();
		expect(startingServerStatus).not.toExist();
		expect(runningServerStatus).not.toExist();
	});

	it('displays status update notices when state changes', async () => {
		// Expect the current server status to be idle (or exited)
		const idleServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Start Jupyter Server"]'
		);
		expect(idleServerStatus).toExist();

		// Click the ribbon icon to start the Jupyter server
		await idleServerStatus.click();

		// Expect the server status to change to starting
		const startingServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Jupyter Server is starting"]'
		);
		await startingServerStatus.waitForExist({ timeout: 30000 });

		// Expect a status update notice to be displayed
		const statusUpdateNotice = (await browser
			.$$('.notice-container .notice .notice-message')
			.find(async (el) => {
				const text = await el.getText();
				return text.includes('Jupyter Server is starting');
			})) as ChainablePromiseElement;
		await statusUpdateNotice.waitForExist({ timeout: 1000 });

		// Wait for the server to be running
		const runningServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Stop Jupyter Server"]'
		);
		await runningServerStatus.waitForExist({ timeout: 30000 });

		// Expect another status update notice to be displayed
		const runningNotice = (await browser
			.$$('.notice-container .notice .notice-message')
			.find(async (el) => {
				const text = await el.getText();
				return text.includes('Jupyter Server is now running');
			})) as ChainablePromiseElement;
		await runningNotice.waitForExist({ timeout: 1000 });

		// Stop the Jupyter server
		await runningServerStatus.click();
		await idleServerStatus.waitForExist({ timeout: 30000 });

		// Expect a status update notice for stopping the server
		const stoppedNotice = (await browser
			.$$('.notice-container .notice .notice-message')
			.find(async (el) => {
				const text = await el.getText();
				return text.includes('Jupyter Server has exited');
			})) as ChainablePromiseElement;
		await stoppedNotice.waitForExist({ timeout: 1000 });
	});

	it('status update notices can be disabled', async () => {
		// Set the vault's settings to disable status update notices
		await resetVaultWithSettings(obsidianPage, { useStatusNotices: false });

		// Wait for past notices to be removed (before the settings were changed)
		const pastNotices = browser.$('.notice-container .notice .notice-message');
		await pastNotices.waitForExist({ timeout: 10000, reverse: true });

		// Expect the current server status to be idle (or exited)
		const idleServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Start Jupyter Server"]'
		);
		expect(idleServerStatus).toExist();

		// Click the ribbon icon to start the Jupyter server
		await idleServerStatus.click();

		// Expect the server status to change to starting
		const startingServerStatus = browser.$(
			'.side-dock-ribbon-action[aria-label="Jupyter Server is starting"]'
		);
		await startingServerStatus.waitForExist({ timeout: 30000 });
		expect(idleServerStatus).not.toExist();

		// Expect no status update notice to be displayed
		const statusUpdateNotice = browser.$('.notice-container .notice .notice-message');
		await statusUpdateNotice.waitForExist({ timeout: 1000, reverse: true });
	});
});
