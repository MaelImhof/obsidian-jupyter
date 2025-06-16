import { expect } from '@wdio/globals';
import type { Browser } from 'webdriverio';
import { ObsidianBrowserCommands } from 'wdio-obsidian-service';

declare const browser: Browser & ObsidianBrowserCommands;

describe('Test my plugin', function() {
    it('test command open-sample-modal-simple', async () => {
        const jupyterButton = await browser.$('[aria-label="Create Jupyter Notebook"]');
        await expect(jupyterButton).toExist();
    })
})