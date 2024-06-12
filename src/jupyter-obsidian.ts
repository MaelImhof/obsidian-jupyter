import { FileSystemAdapter, Notice, Plugin, normalizePath, setIcon, setTooltip } from "obsidian";
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
		DEFAULT_SETTINGS.jupyterEnvType,
		null
	);
	private ribbonIcon: HTMLElement|null = null;

    async onload() {
		await this.loadSettings();
		this.env.printDebugMessages(this.settings.debugConsole);
		this.env.setPythonExecutable(this.settings.pythonExecutable === PythonExecutableType.PYTHON ? "python" : this.settings.pythonExecutablePath);
		this.env.setJupyterTimeoutMs(this.settings.jupyterTimeoutMs);
		this.env.setType(this.settings.jupyterEnvType);
		if (this.settings.deleteCheckpoints) {
			this.env.setCheckpointsPath(await this.getCheckpointsRootFolder());
		}
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

	public async setDeleteCheckpoints(value: boolean) {
		this.settings.deleteCheckpoints = value;
		await this.saveSettings();
		if (value) {
			this.generateJupyterConfig();
			this.env.setCheckpointsPath(this.getCustomJupyterConfigFolderPath());
		}
		else {
			this.deleteJupyterConfig();
			this.env.setCheckpointsPath(null);
		}
	}
	
	public async setMoveCheckpointsToTrash(value: boolean) {
		this.settings.moveCheckpointsToTrash = value;
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

	public async toggleJupyter() {
		switch (this.env.getStatus()) {
			case JupyterEnvironmentStatus.EXITED:
				if (this.settings.deleteCheckpoints && !await this.customJupyterConfigExists()) {
					await this.generateJupyterConfig();
				}
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
		else if (error === JupyterEnvironmentError.JUPYTER_EXITED_WITH_ERROR) {
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
		else {
			new JupyterModal(
				this.app,
				"Jupyter exited",
				[
					"Jupyter crashed while starting but did not encounter an error.",
					"This is a very rare case and might be due to an 'exit()' statement that got lost in your Jupyter configuration.",
					"Use the button below to open the troubleshooting guide.",
					"Here is the last log message from Jupyter:",
					this.env.getLastLog()
				],
				[
					{
						text: "Open troubleshooting guide",
						onClick: () => { window.open("https://jupyter.mael.im/troubleshooting#jupyter-process-exited", "_blank"); },
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

	/**
	 * For the feature that gets rid of the Jupyter checkpoints, the
	 * plugin uses the Jupyter configuration to put all of the checkpoints
	 * in a separate folder. This function computes and returns the absolute
	 * (system) path to that folder, to pass it to Jupyter.
	 * 
	 * Ends with a trailing '/'.
	 */
	private getCheckpointsRootFolder(): string|null {
		// Since the plugin is for desktop only, we can expect a FileSystemAdapter
		const absoluteFolderPath = this.getCustomJupyterConfigFolderPath();
		if (absoluteFolderPath === null) {
			return null;
		}

		return absoluteFolderPath + ".ipynb_checkpoints/";
	}

	/**
	 * The name of the Jupyter configuration file that the plugin uses
	 * to get rid of the checkpoints. No folders involved in this value.
	 * 
	 * Probably has the form `jupyter_someapp_config.py`.
	 */
	private getCustomJupyterConfigFilename(): string {
		return "jupyter_lab_config.py";
	}

	/**
	 * Returns the path to the folder where the Jupyter configuration file
	 * is placed relative to the vault's root.
	 * 
	 * Ends with a trailing '/'.
	 */
	private getCustomJupyterConfigFolderRelativePath(): string {
		if (this.manifest.dir) {
			return this.manifest.dir + "/";
		}
		else {
			return this.app.vault.configDir
				+ "/plugins/"
				+ this.manifest.id
				+ "/";
		}
	}

	/**
	 * Returns the path to the Jupyter configuration file relative to the
	 * vault's root.
	 */
	private getCustomJupyterConfigFileRelativePath(): string {
		return this.getCustomJupyterConfigFolderRelativePath()
			+ this.getCustomJupyterConfigFilename();
	}

	/**
	 * Returns the absolute path (not relative to the vault's root) to the
	 * folder where the Jupyter configuration file is placed.
	 * 
	 * Returns null if on mobile.
	 */
	private getCustomJupyterConfigFolderPath(): string|null {
		// Since the plugin is for desktop only, we can expect a FileSystemAdapter
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			// Get the relative path to the folder
			const relativeFolderPath = this.getCustomJupyterConfigFolderRelativePath();
			// Get the absolute path to the folder
			return this.app.vault.adapter.getFullPath(relativeFolderPath);
		}
		else {
			return null;
		}
	}

	/**
	 * Indicates whether the Jupyter configuration file exists (true) or
	 * needs to be created (false).
	 */
	private async customJupyterConfigExists(): Promise<boolean> {
		// Get the path to the configuration file
		const relativeConfigPath = this.getCustomJupyterConfigFileRelativePath();
		if (relativeConfigPath === null) {
			return false;
		}

		// Check if the file exists
		return await this.app.vault.adapter.exists(normalizePath(relativeConfigPath));
	}

	/**
	 * Generates a Jupyter configuration file in the folder indicated by
	 * `getCustomJupyterConfigPath()` with settings to put all checkpoints
	 * in a single folder.
	 */
	private async generateJupyterConfig(): Promise<boolean> {
		// Then retrieve the path to the checkpoints folder
		const absoluteCheckpointsFolderPath = this.getCheckpointsRootFolder();
		if (absoluteCheckpointsFolderPath === null) {
			return false;
		}

		const relativeConfigPath = this.getCustomJupyterConfigFileRelativePath();

		// Prepare the content to put into the configuration file
		const configContent = `c.FileContentsManager.checkpoints_kwargs = {'root_dir': r'${absoluteCheckpointsFolderPath}'}
print("[Jupyter for Obsidian] Custom configuration of Jupyter for Obsidian loaded successfully.")`

		// Write the config to the file
		await this.app.vault.adapter.write(normalizePath(relativeConfigPath), configContent);
		return true;
	}

	private async deleteJupyterConfig() {
		const relativeConfigPath = this.getCustomJupyterConfigFileRelativePath();
		if (relativeConfigPath === null) {
			return;
		}
		await this.app.vault.adapter.remove(normalizePath(relativeConfigPath));
	}

	async onunload() {
		await this.saveSettings();
		// Kill the Jupyter Notebook process
		this.env.exit();
	}
}