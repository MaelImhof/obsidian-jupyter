import { expect } from '@wdio/globals';
import type { Browser, ChainablePromiseElement } from 'webdriverio';
import { ObsidianBrowserCommands, ObsidianPage } from 'wdio-obsidian-service';
import { DEFAULT_SETTINGS, JupyterSettings } from '../bridge';
import { lstat } from 'fs/promises';

/**
 * Constants for various timeouts used in tests. Centralizes timeout
 * values to ensure consistency and ease of maintenance.
 */
export enum TIMEOUT {
	CREATE_NOTEBOOK = 5000,
	START_SERVER = 60000,
	SERVER_RIBBON_UPDATE = 5000,
	CONTEXT_MENU_UPDATE = 2000,
	CHECKPOINTS_FOLDER = 15000,
	TAB_UPDATE = 5000,
	NOTEBOOK_LOAD = 10000,
	STATUS_NOTICE = 2000,
	NOTICES_CLEARED = 10000
}

/**
 * Finds the element representing the specified file or folder in the Obsidian file tree.
 *
 * If the path contains multiple parts, the wanted element might not exist at the time of calling the function. This is because
 * folders might be collapsed, and children of collapsed folders are not rendered in the DOM.
 *
 * This function traverses the file tree by expanding folders as necessary, ensuring that each part of the part is visible before
 * checking for existence.
 *
 * @param path Path of the wanted file or folder. Should be relative to the vault root and use forward slashes (e.g., "folder/file.txt").
 * @param browser The browser instance to use for finding the element.
 * @returns The found file or folder element.
 *
 * @throws Will throw an error if the path is invalid or if the element cannot be found.
 */
export async function getFileTreeItem(
	path: string,
	browser: Browser & ObsidianBrowserCommands
): Promise<ChainablePromiseElement> {
	const parts = path.split('/');
	if (parts.length === 0) {
		throw new Error('Path must contain at least one part');
	}

	let currentPath = '';
	for (let i = 0; i < parts.length; i++) {
		currentPath += parts[i];
		const item = browser.$(`[data-path="${currentPath}"]`);
		await item.waitForExist({ timeout: 1000 });
		const isFolder = (await item.getAttribute('class')).includes('folder');
		if (i < parts.length - 1) {
			// If not the last part, ensure it's a folder
			expect(item).toExist();
			expect(isFolder).toBe(true);
			currentPath += '/';
			// Get the parent element of the current item
			const parent = item.parentElement();
			// Ensure the parent is not collapsed
			const isCollapsed = (await parent.getAttribute('class')).includes('is-collapsed');
			if (isCollapsed) {
				await item.click();
			}
		} else {
			// If the last part, it can be a file or folder
			expect(item).toExist();
		}
	}

	// Once we expanded all folders, return the item we are interested in
	return browser.$(`[data-path="${path}"]`);
}

/**
 * Resets the Obsidian vault AND its settings.
 *
 * It is possible to pass some settings to override the default ones, allowing the tests to modify the settings in the files
 * directly. Obsidian will detect the changes and tell the plugin that the settings have changed. The handler for such an
 * event is implemented in Jupyter for Obsidian for this specific testing purpose.
 *
 * @param obsidianPage The Obsidian page functionality to use for resetting the vault.
 * @param value Special settings values to override the default ones. If not provided, the default settings will be used.
 */
export async function resetVaultWithSettings(
	obsidianPage: ObsidianPage,
	value: Partial<JupyterSettings>
): Promise<void> {
	const finalSettings: JupyterSettings = {
		...DEFAULT_SETTINGS,
		...value
	};

	await obsidianPage.resetVault('test-vault', {
		[(await obsidianPage.getConfigDir()) + '/plugins/jupyter/data.json']:
			JSON.stringify(finalSettings)
	});
}

/**
 * Checks whether a folder exists at the specified path.
 */
export async function folderExists(path): Promise<boolean> {
	try {
		const stats = await lstat(path);
		if (stats.isDirectory()) {
			// The path exists and is a directory
			return true;
		} else {
			// Exists but is not a directory
			return false;
		}
	} catch (err) {
		// Does not exist or is not accessible
		return false;
	}
}
