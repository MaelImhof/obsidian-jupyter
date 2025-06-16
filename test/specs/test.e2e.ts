import { expect } from '@wdio/globals';
import type { Browser } from 'webdriverio';
import { ObsidianBrowserCommands } from 'wdio-obsidian-service';

declare const browser: Browser & ObsidianBrowserCommands;

async function getFileTreeItem(path: string, browser: Browser & ObsidianBrowserCommands) {
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
            const parent = await item.parentElement();
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

describe('Jupyter for Obsidian', function() {
    beforeEach(async function() {
        await browser.reloadObsidian({vault: "test-vault"});
    });

    it('can open valid notebook', async () => {
        // Expect the current server status to be idle (or exited)
        const idleServerStatus = await browser.$('.side-dock-ribbon-action[aria-label="Start Jupyter Server"]');
        expect(idleServerStatus).toExist();

        // Click on a Jupyter notebook to open it
        const notebook = await getFileTreeItem("Notebook creation/Valid notebook.ipynb", browser);
        await expect(notebook).toExist();
        await notebook.click();

        // Expect the server status to change to starting
        const startingServerStatus = await browser.$('.side-dock-ribbon-action[aria-label="Jupyter Server is Starting"]');
        startingServerStatus.waitForExist({ timeout: 2000 });

        // Wait for a tab to open with the notebook
        const tabHeader = await browser.$('.workspace-tab-header.is-active[aria-label="Valid notebook.ipynb"]');
        await tabHeader.waitForExist({ timeout: 5000 });

        // Check that the notebook entry in the tree is marked as active
        expect((await notebook.getAttribute('class')).includes('is-active')).toBe(true);

        // Check that a message is being displayed while the notebook is loading
        const viewContent = await browser.$('.view-content');
        expect(viewContent).toExist();
        const messageContainer = await viewContent.$('.jupyter-message-container');
        await messageContainer.waitForExist({ timeout: 2000 });

        // Expect Jupyter status to be running after a while
        const runningServerStatus = await browser.$('.side-dock-ribbon-action[aria-label="Stop Jupyter Server"]');
        await runningServerStatus.waitForExist({ timeout: 30000 });
        
        // Check that the notebook content is loaded
        const jupyterWebview = await browser.$('webview.jupyter-webview');
        await jupyterWebview.waitForExist({ timeout: 5000 });

        // Check that the notebook entry in the tree is still marked as active
        expect((await notebook.getAttribute('class')).includes('is-active')).toBe(true);

        // Stop the Jupyter server
        await runningServerStatus.click();
        await idleServerStatus.waitForExist({ timeout: 2000 });

        // Check that the Jupyter webview is no longer present
        const jupyterWebviewExists = await jupyterWebview.isExisting();
        expect(jupyterWebviewExists).toBe(false);

        // Check that the notebook entry in the tree is still marked as active
        expect((await notebook.getAttribute('class')).includes('is-active')).toBe(true);
    });

    it('creates new notebooks from a ribbon icon', async () => {
        // Find the ribbon icon to create a new notebook
        const createNotebookButton = await browser.$('.side-dock-ribbon-action[aria-label="Create Jupyter Notebook"]');
        expect(createNotebookButton).toExist();

        // Create a new notebook by clicking the button
        await createNotebookButton.click();

        // Find the new notebook with a name such as "Jupyter Notebook YYYY-MM-DD-HH-mm-SS.ipynb"
        // If this plugin makes it past 2099, the test will break, but I'm not too worried about that
        const newNotebook = await browser.$('.workspace-tab-header.is-active[aria-label^="Jupyter Notebook 20"]');
        await newNotebook.waitForExist({ timeout: 5000 });
        
        // Check that the new notebook is opened and Jupyter is started
        const startingServerStatus = await browser.$('.side-dock-ribbon-action[aria-label="Jupyter Server is Starting"]');
        startingServerStatus.waitForExist({ timeout: 2000 });
    });
})