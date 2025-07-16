import JupyterForObsidian from '@/jupyter-for-obsidian';
import { IFeature } from '../plugin-feature';
import { registerDeleteCheckpointsSettings } from './delete-checkpoints-settings';
import {
	getDefaultCheckpointsRootFolder,
	purgeJupyterCheckpoints
} from './jupyter-checkpoints-utils';
import { JupyterEnvironment, JupyterEnvironmentEvent } from '@/services/jupyter-environment';
import { getPluginFolder } from '@/services/path-utils';
import { customJupyterConfigExists, generateJupyterConfig } from './jupyter-config-utils';

/**
 * Feature that allows the user to configure automatic deletion of Jupyter
 * checkpoints.
 *
 * When using Jupyter, checkpoints are created automatically to save the
 * state of the notebook at a given time. By default, these checkpoints
 * are created under a subfolder in the notebook folder, which can,
 * overtime, clutter the Obsidian vault with many files that are not
 * useful to the user.
 *
 * Unfortunately, I could not find a way to tell Jupyter to not create
 * checkpoints at all (seems to be a known issue online), so I implemented
 * a way for the plugin to delete these checkpoints automatically
 * after the Jupyter environment exits.
 */
export class DeleteCheckpointsFeature implements IFeature {
	private plugin: JupyterForObsidian;

	async onload(plugin: JupyterForObsidian): Promise<void> {
		this.plugin = plugin;

		// Whenever the Jupyter environment exits, we purge the checkpoints
		this.plugin.env.on(JupyterEnvironmentEvent.EXIT, (env) => this.onJupyterExit(env));

		// If the user has enabled checkpoints deletion, we want to set up
		// the custom Jupyter configuration before starting Jupyter.
		this.plugin.env.on(JupyterEnvironmentEvent.ABOUT_TO_START, () =>
			this.setupBasedOnSettings()
		);

		// Register the settings UI for this feature
		registerDeleteCheckpointsSettings(
			this.plugin.settingsTab,
			getDefaultCheckpointsRootFolder(this.plugin)
		);

		// Make sure the checkpoints folder always ends with a slash
		this.plugin.settingsProxy.on('change:checkpointsFolder', (newVal, _oldVal) => {
			if (newVal !== '' && !newVal.endsWith('/')) {
				newVal += '/';
				this.plugin.settings.checkpointsFolder = newVal;
			}
		});
		if (
			this.plugin.settings.checkpointsFolder !== '' &&
			!this.plugin.settings.checkpointsFolder.endsWith('/')
		) {
			this.plugin.settings.checkpointsFolder += '/';
		}
	}

	/**
	 * Called right before the Jupyter environment starts. Performs
	 * last-minute configuration based on the current settings.
	 *
	 * If checkpoints deletion is enabled, creates a custom Jupyter
	 * configuration file to tell Jupyter to put all checkpoints in a
	 * single place. Also configures the environment to use this
	 * Jupyter configuration file.
	 */
	private async setupBasedOnSettings(): Promise<void> {
		if (this.plugin.settings.deleteCheckpoints) {
			this.plugin.env.setCustomConfigFolderPath(
				getPluginFolder(this.plugin).getAbsolutePath()
			);
			if (!(await customJupyterConfigExists(this.plugin))) {
				await generateJupyterConfig(this.plugin);
			}
		} else {
			this.plugin.env.setCustomConfigFolderPath(null);
		}
	}

	/** Whenever the Jupyter environment is stopped, delete checkpoints. */
	private async onJupyterExit(_env: JupyterEnvironment): Promise<void> {
		await purgeJupyterCheckpoints(this.plugin);
	}

	onunload(): void {
		purgeJupyterCheckpoints(this.plugin);
	}
}
