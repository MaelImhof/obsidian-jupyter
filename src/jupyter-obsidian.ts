import { FileSystemAdapter, Notice, Plugin, setIcon, setTooltip } from "obsidian";
import { JupyterEnvironment, JupyterEnvironmentEvent, JupyterEnvironmentStatus } from "./jupyter-env";
import { EmbeddedJupyterView } from "./jupyter-view";
import { DEFAULT_SETTINGS, JupyterSettings, JupyterSettingsTab } from "./jupyter-settings";

export default class JupyterNotebookPlugin extends Plugin {

	public settings: JupyterSettings = DEFAULT_SETTINGS;
	public readonly env: JupyterEnvironment = new JupyterEnvironment((this.app.vault.adapter as FileSystemAdapter).getBasePath(), this.settings.debugConsole);
	private ribbonIcon: HTMLElement|null = null;

    async onload() {
		await this.loadSettings();
		this.env.on(JupyterEnvironmentEvent.CHANGE, this.showStatusMessage.bind(this));
		this.env.on(JupyterEnvironmentEvent.CHANGE, this.updateRibbon.bind(this));
		this.ribbonIcon = this.addRibbonIcon("monitor-play", "Start Jupyter Server", this.toggleJupyter.bind(this));

		this.registerView("jupyter-view", (leaf) => new EmbeddedJupyterView(leaf, this));
		this.registerExtensions(["ipynb"], "jupyter-view");
		this.addSettingTab(new JupyterSettingsTab(this.app, this));
	}

	private async loadSettings() {
		this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData());
	}

	public async setRibbonIconSetting(value: boolean) {
		this.settings.displayRibbonIcon = value;
		await this.saveSettings();
		if (!value) {
			this.ribbonIcon?.remove();
			this.ribbonIcon = null;
		}
		else {
			this.ribbonIcon = this.addRibbonIcon("monitor-play", "Start Jupyter Server", this.toggleJupyter.bind(this));
			this.updateRibbon(this.env);
		}
	}

	public async setStatusNoticesSetting(value: boolean) {
		this.settings.useStatusNotices = value;
		await this.saveSettings();
	}

	public async setStartJupyterAuto(value: boolean) {
		this.settings.startJupyterAuto = value;
		await this.saveSettings();
	}

	public async setDebugConsole(value: boolean) {
		this.settings.debugConsole = value;
		await this.saveSettings();
		this.env.printDebugMessages(this.settings.debugConsole);
	}

	public async saveSettings() {
		await this.saveData(this.settings);
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

	private showStatusMessage() {
		if (!this.settings.useStatusNotices) {
			return;
		}
		
		switch (this.env.getStatus()) {
			case JupyterEnvironmentStatus.STARTING:
				new Notice("Jupyter Server is starting");
				break;
			case JupyterEnvironmentStatus.RUNNING:
				new Notice("Jupyter Server is now running");
				break;
			case JupyterEnvironmentStatus.EXITED:
				new Notice("Jupyter Server has exited");
				break;
		}
	
	}

	private async updateRibbon(env: JupyterEnvironment) {
		if (this.ribbonIcon === null || !this.settings.displayRibbonIcon) {
			return;
		}

		switch (env.getStatus()) {
			case JupyterEnvironmentStatus.STARTING:
				setIcon(this.ribbonIcon as HTMLElement, "monitor-dot");
				setTooltip(this.ribbonIcon as HTMLElement, "Jupyter Server is starting");
				break;
			case JupyterEnvironmentStatus.RUNNING:
				setIcon(this.ribbonIcon as HTMLElement, "monitor-stop");
				setTooltip(this.ribbonIcon as HTMLElement, "Stop Jupyter Server");
				break;
			case JupyterEnvironmentStatus.EXITED:
				setIcon(this.ribbonIcon as HTMLElement, "monitor-play");
				setTooltip(this.ribbonIcon as HTMLElement, "Start Jupyter Server");
				break;
		}
	}

	async onunload() {
		await this.saveSettings();
		// Kill the Jupyter Notebook process
		this.env.exit();
	}
}