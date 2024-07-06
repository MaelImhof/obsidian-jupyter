/**
 * This file has been strongly inspired by (if not copied from)
 * https://github.com/chhoumann/quickadd/blob/08f269393c3cec5bf0c1d64a79d7999afd0a35a9/src/gui/UpdateModal/UpdateModal.ts
 * 
 * Only small tweaks have been applied to adapt it for the plugin at hand.
 * 
 * Thank you very much @chhoumann !
 */

import { App, ButtonComponent, Component, MarkdownRenderer, Modal, Notice, Setting } from "obsidian";
import JupyterNotebookPlugin from "src/jupyter-obsidian";

/**
 * Represents a subset of the attributes of a GitHub release.
 */
type Release = {
    tag_name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
}

type ErrorMessage = {
    message: string;
}

/**
 * Get a list of releases for a GitHub repository. Filter out drafts, only include beta
 * releases if the current user has a beta version installed.
 * 
 * @param repoOwner GitHub username of the repository's owner
 * @param repoName GitHub repository name (for example "obsidian-jupyter")
 * @param fromRelease The tag of the last announced release (release notes for this won't be included)
 * @param toRelease The tag of the new version to announce (release notes up to and including this will be shown)
 * 
 * @returns A list of releases since `fromRelease` (not included) and up to `toRelease` (included)
 * @throws An error if the request to the API fails or specified releases are not found
 */
async function getReleaseNotes(repoOwner: string, repoName: string, fromRelease: string, toRelease: string): Promise<Release[]> {
    // Get a complete list of releases from GitHub
    const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/releases`);

    // Parse the JSON response into either a list of an error
    const releases: Release[] | ErrorMessage = await response.json();

    // If the response was an error, throw one
    if ((!response.ok && "message" in releases) || !Array.isArray(releases)) {
        throw new Error(
            `Failed to fetch releases: ${releases.message ?? "Unknown error"}`
        );
    }

    // Slice the array to keep only the releases from and to the given params,
    // Note that index 0 is the latest release, and length-1 is the first
    const firstReleaseIndex = fromRelease === ""
        ? releases.length
        : releases.findIndex((release) => release.tag_name === fromRelease);
    if (firstReleaseIndex === -1) {
        throw new Error(`Could not find release with tag ${fromRelease}`);
    }
    const lastReleaseIndex = toRelease === ""
        ? 0 // Take up to the last release
        : releases.findIndex((release) => release.tag_name === toRelease);
    if (lastReleaseIndex === -1) {
        throw new Error(`Could not find release with tag ${toRelease}`);
    }

    // If the user is using beta versions of the plugin, release notes
    // should include pre-releases, otherwise it should not
    const beta = fromRelease.endsWith("-beta");

    // Slice and filter before returning
    return releases
        .slice(lastReleaseIndex, firstReleaseIndex)
        .filter((release) => !release.draft && (beta || !release.prerelease));    
}

function addExtraHashToHeadings(
	markdownText: string,
	numHashes = 1
): string {
	// Split the markdown text into an array of lines
	const lines = markdownText.split("\n");

	// Loop through each line and check if it starts with a heading syntax (#)
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].startsWith("#")) {
			// If the line starts with a heading syntax, add an extra '#' to the beginning
			lines[i] = "#".repeat(numHashes) + lines[i];
		}
	}

	// Join the array of lines back into a single string and return it
	return lines.join("\n");
}

export class UpdateModal extends Modal {
	private releases: Release[];
    private lastAnnounced: string;
    private toAnnounce: string;
    private plugin: JupyterNotebookPlugin;

	constructor(app: App, plugin: JupyterNotebookPlugin, lastAnnouncedVersion: string, versionToAnnounce: string) {
		super(app);
        this.plugin = plugin;
        this.lastAnnounced = lastAnnouncedVersion;
        this.toAnnounce = versionToAnnounce;

        // Load release notes and display them asynchronously
        void this.loadReleaseNotes();
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h1", {
			text: "Fetching release notes...",
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

    private async loadReleaseNotes() {
        try {
            this.releases = await getReleaseNotes(
                "MaelImhof",
                "obsidian-jupyter",
                this.lastAnnounced,
                this.toAnnounce
            );

            if (this.releases.length === 0) {
                this.close();
                return;
            }

            this.display();
        }
        catch (err) {
            this.releases = [];
            this.display();
        }
    }

	private display(): void {
		const { contentEl } = this;
		contentEl.empty();

        contentEl.createEl("h1", {
            text: `Jupyter for Obsidian v${this.toAnnounce}`
        });
        contentEl.createEl("p", {
            text: "Hi !"
        })
        contentEl.createEl("p", {
            text: "Thank you for using Jupyter for Obsidian, hope you like it so far ! I'd love to have your feedback if you have some time."
        });
        new Setting(contentEl)
            .addButton(((feedbackBtn: ButtonComponent) => {
                feedbackBtn
                    .setIcon("message-circle")
                    .setButtonText("Give feedback")
                    .onClick(() => { window.open("https://jupyter.mael.im/#providing-feedback", "_blank"); });
            }).bind(this))
            .addButton(((disableBtn: ButtonComponent) => {
                disableBtn
                    .setIcon("megaphone-off")
                    .setButtonText("Disable update popups")
                    .onClick((() => {
                        void this.plugin.setUpdatePopup(false);
                        new Notice("Jupyter for Obsidian won't display update popups anymore.");
                    }).bind(this))
            }).bind(this));
        
		const contentDiv = contentEl.createDiv();
        
        if (!this.releases || this.releases.length === 0) {
            void MarkdownRenderer.render(
                this.app,
                `> [!FAILURE]\n> Release notes could not be retrieved. You can still look at the last releases [on GitHub](https://github.com/MaelImhof/obsidian-jupyter/releases) directly.`,
                contentDiv,
                this.app.vault.getRoot().path,
                new Component()
            );
        }
        else {
            contentEl.createEl("h2", {
                text: "What changed?"
            });

            const changeLogRegex = /## Change Log\s{1,5}([\s\S]*)$/;
		    const releaseNotes = this.releases
		    	.map((release) => {
                    const results = release.body.match(changeLogRegex);
                    let changelog = results === null
                        ? "Could not load this changelog."
                        : results[1];
                    return `### [Jupyter for Obsidian v${release.tag_name}](https://github.com/MaelImhof/obsidian-jupyter/releases/tag/${release.tag_name})\n\n${addExtraHashToHeadings(changelog)}`;
                })
		    	.join("\n---\n");

            void MarkdownRenderer.render(
                this.app,
                releaseNotes,
                contentDiv,
                this.app.vault.getRoot().path,
                new Component()
            );
        }
	}
}