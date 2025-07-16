import { FileSystemAdapter, Plugin } from "obsidian";
import { JupyterEnvironment, JupyterEnvironmentEvent, JupyterEnvironmentStatus } from "./jupyter-env";
import { DEFAULT_SETTINGS, JupyterSettings, PythonExecutableType } from "./jupyter-settings";

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

	public async saveSettings() {
		await this.saveData(this.settings);
	}


	/*=====================================================*/
	/* Jupyter Environment event (on change, error, exit)  */
	/*=====================================================*/

	private async onJupyterExit(_env: JupyterEnvironment) {
		await this.purgeJupyterCheckpoints();
	}
}