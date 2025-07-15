import { FileSystemAdapter, Notice, Plugin, normalizePath } from "obsidian";
import { JupyterEnvironment, JupyterEnvironmentEvent, JupyterEnvironmentStatus, JupyterEnvironmentType } from "./jupyter-env";
import { DEFAULT_SETTINGS, JupyterSettings, PythonExecutableType } from "./jupyter-settings";
import { UpdateModal } from "./ui/jupyter-update-modal";
import { existsSync, rmdirSync } from "fs";
import { JupyterAbstractPath } from "./utils/jupyter-path";

export default class JupyterNotebookPlugin extends Plugin {

	/*=====================================================*/
	/* Plugin instance properties                          */
	/*=====================================================*/

	public settings: JupyterSettings = DEFAULT_SETTINGS;

	public readonly env: JupyterEnvironment = new JupyterEnvironment(
		(this.app.vault.adapter as FileSystemAdapter).getBasePath(),
		DEFAULT_SETTINGS.debugConsole,
		DEFAULT_SETTINGS.pythonExecutable === PythonExecutableType.PYTHON ? "python" : DEFAULT_SETTINGS.pythonExecutablePath,
		DEFAULT_SETTINGS.jupyterTimeoutMs,
		DEFAULT_SETTINGS.jupyterEnvType,
		null,
		DEFAULT_SETTINGS.useSimpleMode
	);


	/*=====================================================*/
	/* Obsidian hooks (load, unload)                       */
	/*=====================================================*/

    async onload() {
		if (this.settings.deleteCheckpoints) {
			this.env.setCustomConfigFolderPath(this.getPluginFolder().getAbsolutePath());
		}
		this.env.on(JupyterEnvironmentEvent.EXIT, this.onJupyterExit.bind(this));
	}

	async onunload() {
		await this.purgeJupyterCheckpoints();
	}


	/*=====================================================*/
	/* UI Events (ribbon icon, server setting)             */
	/*=====================================================*/

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


	/*=====================================================*/
	/* Settings (load, save, set values)                   */
	/*=====================================================*/

	private async loadSettings() {
		if (this.settings.checkpointsFolder !== "" && !this.settings.checkpointsFolder.endsWith('/')) {
			this.settings.checkpointsFolder += '/';
			await this.saveSettings();
		}
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
		if (value !== "" && !value.endsWith('/')) {
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

	public async setUpdatePopup(value: boolean) {
		this.settings.updatePopup = value;
		await this.saveSettings();
	}

	public async saveSettings() {
		await this.saveData(this.settings);
	}


	/*=====================================================*/
	/* Jupyter Environment event (on change, error, exit)  */
	/*=====================================================*/

	private async onJupyterExit(_env: JupyterEnvironment) {
		await this.purgeJupyterCheckpoints();
	}


	/*=====================================================*/
	/* Jupyter checkpoints management                      */
	/*=====================================================*/

	private async purgeJupyterCheckpoints() {
		// Find what the folder to delete is, where the checkpoints are stored
		let checkpointsFolder: JupyterAbstractPath;
		try {
			checkpointsFolder = this.getCheckpointsRootFolder();
		}
		catch (e: any) {
			// The root folder of the Jupyter checkpoints cannot be found, most probably
			// because the plugin is being executed on mobile.
			return;
		}

		// Check that the folder exists
		if (!existsSync(checkpointsFolder.getAbsolutePath())) {
			return;
		}

		// If the root checkpoints folder was found, delete it
		if (!this.settings.deleteCheckpoints || this.settings.moveCheckpointsToTrash) {
			// Even if the setting is disabled, we do not want to keep the
			// special checkpoints folder around, but we move it to the bin so
			// that it is still recoverable.

			// Trashing is only possible inside of the vault for now
			if (checkpointsFolder.inVault()) {
				this.app.vault.adapter.trashSystem(checkpointsFolder.getRelativePath() as string);
			}
			else {
				new Notice("[Jupyter for Obsidian] ERROR\n\nMoving the Jupyter checkpoints to the " +
					"system trash is only possible when the checkpoints are stored inside of the vault.\n\n" +
					"Please consider changing either the checkpoints folder path setting to one that is inside " +
					"the vault, or define the checkpoints to be deleted without going to the trash.\n\n" +
					"Your checkpoints were not deleted nor moved to the trash.", 0);
			}
		}
		else {
			// Prefer to use the Obsidian's vault adapter where possible
			if (checkpointsFolder.inVault()) {
				this.app.vault.adapter.rmdir(checkpointsFolder.getRelativePath() as string, true);
			}
			else {
				rmdirSync(checkpointsFolder.getAbsolutePath(), { recursive: true });
			}
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