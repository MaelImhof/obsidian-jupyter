import { FileSystemAdapter, Notice, Plugin, normalizePath, setIcon, setTooltip } from "obsidian";
import { JupyterEnvironment, JupyterEnvironmentError, JupyterEnvironmentEvent, JupyterEnvironmentStatus, JupyterEnvironmentType } from "./jupyter-env";
import { EmbeddedJupyterView } from "./ui/jupyter-view";
import { DEFAULT_SETTINGS, JupyterSettings, JupyterSettingsTab, PythonExecutableType } from "./jupyter-settings";
import { JupyterModal } from "./ui/jupyter-modal";
import { unlinkSync } from "fs";
import trash from "trash";
import { JupyterAbstractPath } from "./utils/jupyter-path";

export default class JupyterNotebookPlugin extends Plugin {

	/*=====================================================*/
	/* Plugin instance properties                          */
	/*=====================================================*/

	public settings: JupyterSettings = DEFAULT_SETTINGS;
	private ribbonIcon: HTMLElement|null = null;

	public readonly env: JupyterEnvironment = new JupyterEnvironment(
		(this.app.vault.adapter as FileSystemAdapter).getBasePath(),
		DEFAULT_SETTINGS.debugConsole,
		DEFAULT_SETTINGS.pythonExecutable === PythonExecutableType.PYTHON ? "python" : DEFAULT_SETTINGS.pythonExecutablePath,
		DEFAULT_SETTINGS.jupyterTimeoutMs,
		DEFAULT_SETTINGS.jupyterEnvType,
		null
	);
	private envProperlyInitialized = false;
	private startEnvOnceInitialized = false;


	/*=====================================================*/
	/* Obsidian hooks (load, unload)                       */
	/*=====================================================*/

    async onload() {
		await this.loadSettings();
		this.env.printDebugMessages(this.settings.debugConsole);
		this.env.setPythonExecutable(this.settings.pythonExecutable === PythonExecutableType.PYTHON ? "python" : this.settings.pythonExecutablePath);
		this.env.setJupyterTimeoutMs(this.settings.jupyterTimeoutMs);
		this.env.setType(this.settings.jupyterEnvType);
		if (this.settings.deleteCheckpoints) {
			this.env.setCustomConfigFolderPath(this.getPluginFolder().getAbsolutePath());
		}
		this.env.on(JupyterEnvironmentEvent.CHANGE, this.showStatusMessage.bind(this));
		this.env.on(JupyterEnvironmentEvent.CHANGE, this.updateRibbon.bind(this));
		this.env.on(JupyterEnvironmentEvent.ERROR, this.onEnvironmentError.bind(this));
		this.env.on(JupyterEnvironmentEvent.EXIT, this.onJupyterExit.bind(this));
		this.envProperlyInitialized = true;
		if (this.startEnvOnceInitialized) {
			this.toggleJupyter();
		}
		this.ribbonIcon = this.addRibbonIcon("monitor-play", "Start Jupyter Server", this.toggleJupyter.bind(this));

		this.registerView("jupyter-view", (leaf) => new EmbeddedJupyterView(leaf, this));
		this.registerExtensions(["ipynb"], "jupyter-view");
		this.addSettingTab(new JupyterSettingsTab(this.app, this));
	}

	async onunload() {
		await this.saveSettings();
		// Kill the Jupyter Notebook process
		this.env.exit();
		await this.purgeJupyterCheckpoints();
	}


	/*=====================================================*/
	/* UI Events (ribbon icon, server setting)             */
	/*=====================================================*/

	public async toggleJupyter() {
		// If the environment is not properly initialized, it cannot be started
		// This case can occur when the plugin is loading while views are also being loaded,
		// and one of them requests Jupyter to be started.
		if (!this.envProperlyInitialized) {
			this.startEnvOnceInitialized = true;
			return;
		}

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

	/**
	 * Restarts the Jupyter server if it is running.
	 * 
	 * If Jupyter is not running, it is simply started.
	 */
	public async restartJupyter() {
		if (this.env.getStatus() === JupyterEnvironmentStatus.EXITED) {
			this.toggleJupyter();
		}
		else {
			this.env.once(JupyterEnvironmentEvent.EXIT, (() => {
				this.toggleJupyter();
			}).bind(this));
			this.env.exit();
		}
	}


	/*=====================================================*/
	/* Settings (load, save, set values)                   */
	/*=====================================================*/

	private async loadSettings() {
		this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData());
		if (!this.settings.checkpointsFolder.endsWith('/')) {
			this.settings.checkpointsFolder += '/';
			await this.saveSettings();
		}
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

	public async setStartJupyterAuto(value: boolean) {
		this.settings.startJupyterAuto = value;
		await this.saveSettings();
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
			await this.generateJupyterConfig();
			this.env.setCustomConfigFolderPath(this.getPluginFolder().getAbsolutePath());
		}
		else {
			await this.deleteJupyterConfig();
			this.env.setCustomConfigFolderPath(null);
		}
	}
	
	public async setMoveCheckpointsToTrash(value: boolean) {
		this.settings.moveCheckpointsToTrash = value;
		await this.saveSettings();
	}

	public async setCheckpointsFolder(value: string) {
		// Make sure the provided checkpoints folder ends with '/'
		if (!value.endsWith('/')) {
			value += '/';
		}
		this.settings.checkpointsFolder = value;
		await this.saveSettings();
		// Update the custom Jupyter config to take into account the new checkpoints folder
		// (requires Jupyter to be restarted)
		if (this.settings.deleteCheckpoints) {
			await this.generateJupyterConfig();
		}
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

	public async setJupyterTimeoutMs(value: number) {
		this.settings.jupyterTimeoutMs = value;
		await this.saveSettings();
		this.env.setJupyterTimeoutMs(value);
	}

	public async setDebugConsole(value: boolean) {
		this.settings.debugConsole = value;
		await this.saveSettings();
		this.env.printDebugMessages(this.settings.debugConsole);
	}

	public async saveSettings() {
		await this.saveData(this.settings);
	}


	/*=====================================================*/
	/* Jupyter Environment event (on change, error, exit)  */
	/*=====================================================*/

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

	private async onJupyterExit(_env: JupyterEnvironment) {
		await this.purgeJupyterCheckpoints();
	}


	/*=====================================================*/
	/* Jupyter checkpoints management                      */
	/*=====================================================*/

	private async purgeJupyterCheckpoints() {
		// Find what the folder to delete is, where the checkpoints are stored
		let checkpointsActualRoot: JupyterAbstractPath;
		try {
			checkpointsActualRoot = this.getCheckpointsRootFolder();
		}
		catch (e: any) {
			// The root folder of the Jupyter checkpoints cannot be found, most probably
			// because the plugin is being executed on mobile.
			return;
		}
		
		console.debug("Deleting checkpoints:", checkpointsActualRoot.getAbsolutePath());

		// If the root checkpoints folder was found, delete it
		if (!this.settings.deleteCheckpoints || this.settings.moveCheckpointsToTrash) {
			// Even if the setting is disabled, we do not want to keep the
			// special checkpoints folder around, but we move it to the bin so
			// that it is still recoverable.
			trash(normalizePath(checkpointsActualRoot.getAbsolutePath()));
		}
		else {
			unlinkSync(normalizePath(checkpointsActualRoot.getAbsolutePath()));
		}
	}

	/**
	 * Obsidian plugins are installed in the Obsidian's settings folder, in their
	 * own folder named after themselves.
	 * 
	 * This method provides the path to the folder that hosts Jupyter for Obsidian
	 * and its code, settings and configuration.
	 */
	public getPluginFolder(): JupyterAbstractPath {
		return JupyterAbstractPath.fromRelative(
			this.app.vault.configDir + "/plugins/" + this.manifest.id + "/",
			true,
			this.app.vault
		);
	}

	/**
	 * Provides the default Jupyter checkpoints folder. If the user did not provide any
	 * custom value, the Jupyter checkpoints will be stored in the plugin's settings directory
	 * before being deleted.
	 */
	public getDefaultCheckpointsRootFolder(): JupyterAbstractPath {
		const pluginFolder: JupyterAbstractPath = this.getPluginFolder();
		return pluginFolder.append(".ipynb_checkpoints/", true);
	}

	/**
	 * Provide the path to the custom Jupyter config file ('jupyter_lab_config.py'). This
	 * configuration is used to tell Jupyter where to put checkpoints if the user has enabled
	 * auto-deletion of checkpoints.
	 */
	public getJupyterConfigPath(): JupyterAbstractPath {
		const pluginFolder: JupyterAbstractPath = this.getPluginFolder();
		return pluginFolder.append("jupyter_lab_config.py", false);
	}

	/**
	 * For the feature that gets rid of the Jupyter checkpoints, the plugin uses the Jupyter
	 * configuration to put all of the checkpoints in a separate folder. This function computes
	 * and returns the absolute (system) path to that folder, to pass it to Jupyter.
	 * 
	 * It takes both the default value and the possible user setting value into account.
	 * 
	 * @throws If the file adapter cannot be used to retrieve absolute paths (most probably because on mobile).
	 */
	private getCheckpointsRootFolder(): JupyterAbstractPath {
		// Check that absolute paths can be retrieved
		if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
			throw new Error("Invalid environment : need a file system adapter to work with files outside of the vault (Jupyter for Obsidian).");
		}
		
		// If the user setting has a value, use it
		if (this.settings.checkpointsFolder !== "") {
			return JupyterAbstractPath.fromAbsolute(
				this.settings.checkpointsFolder + ".ipynb_checkpoints",
				true,
				this.app.vault
			);
		}
		// Otherwise, use the default value
		else {
			// The default path is inside of the plugin's folder
			return this.getDefaultCheckpointsRootFolder();
		}
	}

	/**
	 * Indicates whether the Jupyter configuration file exists (true) or
	 * needs to be created (false).
	 */
	private async customJupyterConfigExists(): Promise<boolean> {
		// Find out the path to the Jupyter configuration file
		let configPath: JupyterAbstractPath;
		try { configPath = this.getJupyterConfigPath(); }
		catch (e) { return false; }

		// Check for the config to be in the vault
		if (!configPath.inVault()) {
			return false;
		}

		// Check if the file exists
		// We know configPath.getRelativePath() is not null because we checked for the config to be in the vault
		return await this.app.vault.adapter.exists(normalizePath(configPath.getRelativePath() as string));
	}

	/**
	 * Generates a Jupyter configuration file in the folder indicated by
	 * `getCustomJupyterConfigPath()` with settings to put all checkpoints
	 * in a single folder.
	 */
	private async generateJupyterConfig(): Promise<boolean> {
		// Find out the path to the Jupyter configuration file
		// Find where the checkpoints will have to be stored to then tell Jupyter
		let checkpointsFolder: JupyterAbstractPath;
		let configPath: JupyterAbstractPath;
		try {
			checkpointsFolder = this.getCheckpointsRootFolder();
			configPath = this.getJupyterConfigPath();
		}
		catch (e) { return false; }

		// The configuration file must be within the vault in order to use the vault's adapter
		if (!configPath.inVault()) {
			return false;
		}

		// Prepare the content to put into the configuration file
		const configContent = `c.FileContentsManager.checkpoints_kwargs = {'root_dir': r'${checkpointsFolder.getAbsolutePath()}'}
print("[Jupyter for Obsidian] Custom configuration of Jupyter for Obsidian loaded successfully.")`

		// Write the config to the file
		// We know configPath.getRelativePath() is not null because we checked it is in the vault above
		await this.app.vault.adapter.write(normalizePath(configPath.getRelativePath() as string), configContent);
		return true;
	}

	/**
	 * If the custom Jupyter configuration file used by the Jupyter for Obsidian
	 * plugin exists, it deletes it.
	 */
	private async deleteJupyterConfig() {
		// Find out the path to the Jupyter configuration file
		let configPath: JupyterAbstractPath;
		try { configPath = this.getJupyterConfigPath(); }
		catch (e) { return; }

		// To use the vault adapter, the config path must be within the vault
		if (!configPath.inVault()) {
			return;
		}
		
		// Since we checked the config path is in the vault, it must have a relative path
		await this.app.vault.adapter.remove(normalizePath(configPath.getRelativePath() as string));
	}
}