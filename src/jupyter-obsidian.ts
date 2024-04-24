import { FileSystemAdapter, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { spawnJupyterEnv, JupyterEnv, JupyterEnvEvent } from "./jupyter-env";
// @ts-ignore
import { shell } from "electron";
import { EmbeddedJupyterView } from "./jupyter-view";

export default class JupyterNotebookPlugin extends Plugin {

	public env: JupyterEnv | null = null;

    async onload() {
		this.addRibbonIcon("monitor-play", "Start Jupyter", this.startJupyter.bind(this));
		this.registerView(
			"jupyter-view",
			(leaf) => new EmbeddedJupyterView(leaf, this)
		);
		this.registerExtensions(["ipynb"], "jupyter-view");
	}

	async startJupyter() {
		// Check that a Jupyter environment was not already started
		if (this.env !== null) {
			new Notice("Jupyter environment is already running");
			return;
		}

		// Check that Obsidian is running on a computer
		let path = "";
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			path = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
		}
		else {
			new Notice("Jupyter Notebook can only be started on a computer");
			return;
		}

		// Start the Jupyter environment
		this.env = spawnJupyterEnv(path);
		this.env.on(JupyterEnvEvent.URL, ((url: string) => {
			new Notice("Jupyter Notebook is running");
			shell.openExternal(url);
		}).bind(this));
	}

	// async activateView() {
	// 	const { workspace } = this.app;
	
	// 	let leaf: WorkspaceLeaf | null = null;
	// 	const leaves = workspace.getLeavesOfType("jupyter-view");
	
	// 	if (leaves.length > 0) {
	// 	  // A leaf with our view already exists, use that
	// 	  leaf = leaves[0];
	// 	} else {
	// 	  // Our view could not be found in the workspace, create a new leaf
	// 	  // in the right sidebar for it
	// 	  leaf = workspace.getRightLeaf(false);
	// 	  await leaf.setViewState({ type: "jupyter-view", active: true });
	// 	}
	
	// 	// "Reveal" the leaf in case it is in a collapsed sidebar
	// 	workspace.revealLeaf(leaf);
	//   }

	async onunload() {
		// Kill the Jupyter Notebook process
		if (this.env !== null && this.env.isAlive()) {
			this.env.kill();
		}
	}
}