import { FileSystemAdapter, Notice, Plugin } from "obsidian";
import { spawnJupyterEnv, JupyterEnv, JupyterEnvEvent } from "src/jupyter-env";
// @ts-ignore
import { shell } from "electron";

export default class JupyterNotebookPlugin extends Plugin {

	private env: JupyterEnv | null = null;

    async onload() {
		this.addRibbonIcon("monitor-play", "Start Jupyter", this.startJupyter.bind(this));
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

	async onunload() {
		// Kill the Jupyter Notebook process
		if (this.env !== null && this.env.isAlive()) {
			this.env.kill();
		}
	}
}