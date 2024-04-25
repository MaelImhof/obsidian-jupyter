import { FileSystemAdapter, Notice, Plugin, setIcon, setTooltip } from "obsidian";
import { JupyterEnvironment, JupyterEnvironmentEvent, JupyterEnvironmentStatus } from "./jupyter-env";
import { EmbeddedJupyterView } from "./jupyter-view";
import { JupyterSettingsTab } from "./jupyter-settings";

export default class JupyterNotebookPlugin extends Plugin {

	public readonly env: JupyterEnvironment = new JupyterEnvironment((this.app.vault.adapter as FileSystemAdapter).getBasePath());
	private ribbonIcon: HTMLElement|null = null;

    async onload() {
		this.env.on(JupyterEnvironmentEvent.CHANGE, this.updateRibbon.bind(this));
		this.ribbonIcon = this.addRibbonIcon("monitor-play", "Start Jupyter Server", this.toggleJupyter.bind(this));

		this.registerView("jupyter-view", (leaf) => new EmbeddedJupyterView(leaf, this));
		this.registerExtensions(["ipynb"], "jupyter-view");
		this.addSettingTab(new JupyterSettingsTab(this.app, this));
	}

	private async toggleJupyter() {
		switch (this.env.getStatus()) {
			case JupyterEnvironmentStatus.EXITED:
				this.env.start();
				break;
			case JupyterEnvironmentStatus.RUNNING:
				this.env.exit();
				break;
		}
	}

	private async updateRibbon(env: JupyterEnvironment) {
		switch (env.getStatus()) {
			case JupyterEnvironmentStatus.STARTING:
				new Notice("Starting Jupyter Server");
				setIcon(this.ribbonIcon as HTMLElement, "monitor-dot");
				setTooltip(this.ribbonIcon as HTMLElement, "Jupyter Server is starting");
				break;
			case JupyterEnvironmentStatus.RUNNING:
				new Notice("Jupyter Server is now running");
				setIcon(this.ribbonIcon as HTMLElement, "monitor-stop");
				setTooltip(this.ribbonIcon as HTMLElement, "Stop Jupyter Server");
				break;
			case JupyterEnvironmentStatus.EXITED:
				new Notice("Jupyter Server has exited");
				setIcon(this.ribbonIcon as HTMLElement, "monitor-play");
				setTooltip(this.ribbonIcon as HTMLElement, "Start Jupyter Server");
				break;
		}
	}

	async onunload() {
		// Kill the Jupyter Notebook process
		this.env.exit();
	}
}