import { FileSystemAdapter, Notice, Plugin, setIcon, setTooltip } from "obsidian";
import { JupyterEnvironment, JupyterEnvironmentError, JupyterEnvironmentEvent, JupyterEnvironmentStatus, JupyterEnvironmentType } from "./jupyter-env";
import { EmbeddedJupyterView } from "./jupyter-view";
import { DEFAULT_SETTINGS, JupyterSettings, JupyterSettingsTab, PythonExecutableType } from "./jupyter-settings";
import { JupyterModal } from "./jupyter-modal";

export default class JupyterNotebookPlugin extends Plugin {

	public settings: JupyterSettings = DEFAULT_SETTINGS;
	public readonly env: JupyterEnvironment = new JupyterEnvironment(
		(this.app.vault.adapter as FileSystemAdapter).getBasePath(),
		DEFAULT_SETTINGS.debugConsole,
		DEFAULT_SETTINGS.pythonExecutable === PythonExecutableType.PYTHON ? "python" : DEFAULT_SETTINGS.pythonExecutablePath,
		DEFAULT_SETTINGS.jupyterTimeoutMs,
		DEFAULT_SETTINGS.jupyterEnvType
	);
	private ribbonIcon: HTMLElement|null = null;

    async onload() {
		await this.loadSettings();
		this.env.printDebugMessages(this.settings.debugConsole);
		this.env.setPythonExecutable(this.settings.pythonExecutable === PythonExecutableType.PYTHON ? "python" : this.settings.pythonExecutablePath);
		this.env.setJupyterTimeoutMs(this.settings.jupyterTimeoutMs);
		this.env.setType(this.settings.jupyterEnvType);
		this.env.on(JupyterEnvironmentEvent.CHANGE, this.showStatusMessage.bind(this));
		this.env.on(JupyterEnvironmentEvent.CHANGE, this.updateRibbon.bind(this));
		this.env.on(JupyterEnvironmentEvent.ERROR, this.onEnvironmentError.bind(this));
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

	public async setPythonExecutable(value: PythonExecutableType) {
		this.settings.pythonExecutable = value;
		await this.saveSettings();
		switch (value) {
			case PythonExecutableType.PYTHON:
				this.env.setPythonExecutable("python");
				break;
			case PythonExecutableType.PATH:
				this.env.setPythonExecutable(this.settings.pythonExecutablePath);
				break;
		}
	}

	public async setPythonExecutablePath(value: string) {
		this.settings.pythonExecutablePath = value;
		await this.saveSettings();
		if (this.settings.pythonExecutable === PythonExecutableType.PATH) {
			this.env.setPythonExecutable(value);
		}
	}

	public async setJupyterTimeoutMs(value: number) {
		this.settings.jupyterTimeoutMs = value;
		await this.saveSettings();
		this.env.setJupyterTimeoutMs(value);
	}

	public async setJupyterEnvType(value: JupyterEnvironmentType) {
		this.settings.jupyterEnvType = value;
		await this.saveSettings();
		this.env.setType(value);
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

	private onEnvironmentError(_env: JupyterEnvironment, error: JupyterEnvironmentError) {
		if (error === JupyterEnvironmentError.JUPYTER_STARTING_TIMEOUT) {
			new JupyterModal(
				this.app,
				"Jupyter Timeout",
				[
					"The Jupyter server took too long to start.",
					"You can set in the settings the maximum time the plugin will wait for the server to start.",
					"Your current timeout is set to " + (this.settings.jupyterTimeoutMs / 1000) + " second(s).",
					this.settings.jupyterTimeoutMs < 15000 ? "This is a very short timeout and might not be enough for the server to start. Please try increasing it and see if the error disappears." : "This timeout seems reasonable, hence the problem might be elsewhere depending on your specific situation."
				],
				[
					{
						text: "Open troubleshooting guide",
						onClick: () => { window.open("https://jupyter.mael.im/troubleshooting#jupyter-timeout", "_blank"); },
						closeOnClick: false
					}
				]
			).open();
		}
		else if (error === JupyterEnvironmentError.UNABLE_TO_START_JUPYTER) {
			new JupyterModal(
				this.app,
				"Couldn't start Jupyter",
				[
					"Jupyter could not even be started.",
					"Please check your Python executable and make sure Jupyter is installed in the corresponding environment.",
					"Use the button below to open the troubleshooting guide."
				],
				[
					{
						text: "Open troubleshooting guide",
						onClick: () => { window.open("https://jupyter.mael.im/troubleshooting#jupyter-process-could-not-be-spawned", "_blank"); },
						closeOnClick: false
					}
				]
			)
		}
		else {
			new JupyterModal(
				this.app,
				"Jupyter crashed",
				[
					"Jupyter crashed while starting",
					"Use the button below to open the troubleshooting guide.",
					"Here is the last log message from Jupyter:",
					this.env.getLastLog()
				],
				[
					{
						text: "Open troubleshooting guide",
						onClick: () => { window.open("https://jupyter.mael.im/troubleshooting#jupyter-process-crashed", "_blank"); },
						closeOnClick: false
					}
				]
			).open();
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