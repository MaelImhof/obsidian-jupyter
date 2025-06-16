import * as path from "path"

export const config: WebdriverIO.Config = {
    runner: 'local',

    specs: [
        './test/specs/**/*.e2e.ts'
    ],

    // How many instances of Obsidian should be launched in parallel
    maxInstances: 1,

    capabilities: [{
        browserName: 'obsidian',
        // obsidian app version to download
        browserVersion: "latest",
        'wdio:obsidianOptions': {
            // obsidian installer version
            // (see "Obsidian App vs Installer Versions" below)
            installerVersion: "earliest",
            plugins: ["."],
            // If you need to switch between multiple vaults, you can omit
            // this and use reloadObsidian to open vaults during the tests
            vault: "test-vault",
        },
    }],

    framework: 'mocha',
    services: ["obsidian"],
    // You can use any wdio reporter, but they show the Chromium version
    // instead of the Obsidian version. obsidian reporter just wraps
    // spec reporter to show the Obsidian version.
    reporters: ['obsidian'],

    mochaOpts: {
        ui: 'bdd',
        timeout: 60000,
        // You can set mocha settings like "retry" and "bail"
    },

    cacheDir: path.resolve(".obsidian-cache"),

    logLevel: "warn",
}