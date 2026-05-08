import JupyterForObsidian from '@/jupyter-for-obsidian';
import { IFeature } from '@/features/plugin-feature';
import {
	JupyterEnvironment,
	JupyterEnvironmentError,
	JupyterEnvironmentEvent,
	JupyterEnvironmentStatus,
	PythonExecutableType
} from '@/services/jupyter-environment';
import { Settings, SettingsProxy } from '@/settings';
import { registerOpenNotebookSettingsUI } from './open-notebooks-settings';
import { Notice, setIcon, setTooltip, TAbstractFile, TFile } from 'obsidian';
import { EmbeddedJupyterView, getJupyterViews, JUPYTER_VIEW_TYPE } from '@/services/jupyter-view';
import { displayJupyterErrorModal } from './jupyter-error-modals';

/**
 * Core feature of the Jupyter for Obsidian plugin that allows users to
 * open Jupyter notebooks in Obsidian, with some configuration tweaks
 * (see the feature's settings for more details).
 */
export class OpenNotebooksFeature implements IFeature {
	private plugin!: JupyterForObsidian;
	private serverRibbonIcon: HTMLElement | null = null;

	async onload(plugin: JupyterForObsidian): Promise<void> {
		this.plugin = plugin;

		// Apply settings to the Jupyter environment and make sure settings
		// changes are reflected in the environment.
		this.configureJupyterEnvironment(
			this.plugin.env,
			this.plugin.settings,
			this.plugin.settingsProxy
		);

		// Register this feature's settings to be displayed in the UI
		registerOpenNotebookSettingsUI(this.plugin.settingsTab);

		// Prepare a ribbon icon for the server status (if enabled)
		if (this.plugin.settings.displayServerRibbonIcon) {
			this.serverRibbonIcon = this.plugin.addRibbonIcon(
				'monitor-play',
				'Start Jupyter Server',
				this.plugin.env.toggle.bind(this.plugin.env)
			);
		}
		this.plugin.env.on(JupyterEnvironmentEvent.CHANGE, (env) => this.updateRibbon(env));

		// Show notices whenever the Jupyter environment status changes,
		this.plugin.env.on(JupyterEnvironmentEvent.CHANGE, () => this.showStatusMessage());

		// Display an error message when an error occurs
		this.plugin.env.on(JupyterEnvironmentEvent.ERROR, (args) =>
			this.onEnvironmentError(...args)
		);

		// Let Obsidian know how to display Jupyter files
		this.plugin.registerView(
			JUPYTER_VIEW_TYPE,
			(leaf) => new EmbeddedJupyterView(leaf, this.plugin)
		);

		// Let Obsidian know which file extensions are Jupyter notebooks
		this.plugin.registerExtensions(['ipynb'], JUPYTER_VIEW_TYPE);

		// When a notebook file is deleted, close any views that have it open
		this.plugin.registerEvent(
			this.plugin.app.vault.on(
				'delete',
				(async (file: TAbstractFile) => {
					// We only care about TFile instances
					if (!(file instanceof TFile)) {
						return;
					}

					// We only care about .ipynb files
					if (!file.path.endsWith('.ipynb')) {
						return;
					}

					// Close Jupyter views where this file is opened
					const jupyterViews = getJupyterViews(this.plugin.app.workspace);
					for (const jupyterView of jupyterViews) {
						if (
							jupyterView.file?.path === file.path ||
							// Not sure why, but sometimes a file in the root directory will have a path that
							// does not start with '/', thus the match won't be made and the view won't be closed,
							// unless I manually add this condition below.
							(file.parent === null && jupyterView.file?.path === '/' + file.name)
						) {
							await jupyterView.leaf.setViewState({
								type: JUPYTER_VIEW_TYPE,
								state: { file: null }
							});
						}
					}
				}).bind(this)
			)
		);
	}

	/**
	 * Displays a status notice whenever the Jupyter environment status
	 * changes, except if the user has disabled status notices.
	 */
	private showStatusMessage(): void {
		if (!this.plugin.settings.useStatusNotices) {
			return;
		}

		switch (this.plugin.env.getStatus()) {
			case JupyterEnvironmentStatus.STARTING:
				new Notice('Jupyter Server is starting');
				break;
			case JupyterEnvironmentStatus.RUNNING:
				new Notice('Jupyter Server is now running');
				break;
			case JupyterEnvironmentStatus.EXITED:
				new Notice('Jupyter Server has exited');
				break;
		}
	}

	/**
	 * Every time the Jupyter environment status changes, this method
	 * updates the ribbon icon to reflect the current status (one
	 * icon corresponds to one specific status).
	 */
	private async updateRibbon(env: JupyterEnvironment) {
		if (this.serverRibbonIcon === null || !this.plugin.settings.displayServerRibbonIcon) {
			return;
		}

		switch (env.getStatus()) {
			case JupyterEnvironmentStatus.STARTING:
				setIcon(this.serverRibbonIcon as HTMLElement, 'monitor-dot');
				setTooltip(this.serverRibbonIcon as HTMLElement, 'Jupyter Server is starting');
				break;
			case JupyterEnvironmentStatus.RUNNING:
				setIcon(this.serverRibbonIcon as HTMLElement, 'monitor-stop');
				setTooltip(this.serverRibbonIcon as HTMLElement, 'Stop Jupyter Server');
				break;
			case JupyterEnvironmentStatus.EXITED:
				setIcon(this.serverRibbonIcon as HTMLElement, 'monitor-play');
				setTooltip(this.serverRibbonIcon as HTMLElement, 'Start Jupyter Server');
				break;
		}
	}

	/**
	 * Handles errors that occur in the Jupyter environment by displaying a
	 * modal with information about the error and a link to the
	 * troubleshooting guide.
	 */
	private onEnvironmentError(_env: JupyterEnvironment, error: JupyterEnvironmentError): void {
		displayJupyterErrorModal(this.plugin, error);
	}

	/**
	 * Configures the Jupyter environment with the current settings
	 * and sets up listeners to update the environment
	 * whenever the settings change.
	 */
	private configureJupyterEnvironment(
		env: JupyterEnvironment,
		settings: Settings,
		proxy: SettingsProxy<Settings>
	): void {
		// We need each setting to be reactive so that the Jupyter
		// environment adapts on setting changes.
		proxy.on('change:debugConsole', (newVal, _oldVal) => {
			env.printDebugMessages(newVal);
		});
		// We also need to apply the initial settings to the environment.
		env.printDebugMessages(settings.debugConsole);

		proxy.on('change:pythonExecutable', (_newVal, _oldVal) => {
			env.setPythonExecutable(getPythonExecutablePath(settings));
		});
		proxy.on('change:pythonExecutablePath', (newVal, _oldVal) => {
			if (settings.pythonExecutable === PythonExecutableType.PATH) {
				env.setPythonExecutable(newVal);
			}
		});
		env.setPythonExecutable(getPythonExecutablePath(settings));

		proxy.on('change:jupyterTimeoutMs', (newVal, _oldVal) => {
			env.setJupyterTimeoutMs(newVal);
		});
		env.setJupyterTimeoutMs(settings.jupyterTimeoutMs);

		proxy.on('change:jupyterEnvType', (newVal, _oldVal) => {
			env.setType(newVal);
		});
		env.setType(settings.jupyterEnvType);

		proxy.on('change:useSimpleMode', (newVal, _oldVal) => {
			env.setUseSimpleMode(newVal);
		});
		env.setUseSimpleMode(settings.useSimpleMode);

		// Make sure that the ribbon icon is shown/hidden based on the setting
		proxy.on('change:displayServerRibbonIcon', (newVal, _oldVal) => {
			if (newVal) {
				this.serverRibbonIcon = this.plugin.addRibbonIcon(
					'monitor-play',
					'Start Jupyter Server',
					this.plugin.env.toggle.bind(this.plugin.env)
				);
				this.updateRibbon(this.plugin.env);
			} else {
				this.serverRibbonIcon?.remove();
				this.serverRibbonIcon = null;
			}
		});
	}
}

/**
 * Util function to determine what the actual Python executable path is based on
 * the provided plugin's settings.
 *
 * For example, if the user selected `Python` as the executable type, this function
 * will return simply `python`. If the user selected `Path`, it will return the
 * path specified in the settings.
 */
export function getPythonExecutablePath(settings: Settings): string {
	switch (settings.pythonExecutable) {
		case PythonExecutableType.PYTHON:
			return 'python';
		case PythonExecutableType.PYTHON3:
			return 'python3';
		case PythonExecutableType.PATH:
			return settings.pythonExecutablePath;
	}
}
