import { expect } from '@wdio/globals';
import type { Browser } from 'webdriverio';
import { ObsidianBrowserCommands } from 'wdio-obsidian-service';

export async function getFileTreeItem(path: string, browser: Browser & ObsidianBrowserCommands) {
    const parts = path.split('/');
    if (parts.length === 0) {
        throw new Error("Path must contain at least one part");
    }

    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
        currentPath += parts[i];
        const item = browser.$(`[data-path="${currentPath}"]`);
        await item.waitForExist({ timeout: 1000 });
        const isFolder = (await item.getAttribute("class")).includes("folder");
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