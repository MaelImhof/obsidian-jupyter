import { expect } from '@wdio/globals';
import type { Browser } from 'webdriverio';
import { ObsidianBrowserCommands } from 'wdio-obsidian-service';

declare const browser: Browser & ObsidianBrowserCommands;

describe('Test my plugin', function() {
    before(async function() {
        // You can create test vaults and open them with reloadObsidian
        // Alternatively if all your tests use the same vault, you can
        // set the default vault in the wdio.conf.ts.
        await browser.reloadObsidian({vault: "./test-vault"});
    })
    it('test command open-sample-modal-simple', async () => {
        const jupyterButton = await browser.$('[aria-label="Create Jupyter Notebook"]');
        await expect(jupyterButton).toExist();
    })
})