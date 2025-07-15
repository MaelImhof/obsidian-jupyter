import JupyterForObsidian from "@/jupyter-for-obsidian";
import { IFeature } from "@/features/plugin-feature";
import { JupyterEnvironment, JupyterEnvironmentError, JupyterEnvironmentEvent, JupyterEnvironmentStatus, PythonExecutableType } from "@/services/jupyter-environment";
import { Settings, SettingsProxy } from "@/settings";
import { registerOpenNotebookSettingsUI } from "./open-notebooks-settings";
import { Notice, setIcon, setTooltip } from "obsidian";
import { JupyterModal } from "@/services/jupyter-modal";
import { EmbeddedJupyterView } from "@/services/jupyter-view";

export class OpenNotebooksFeature implements IFeature {
    private plugin: JupyterForObsidian;
    private serverRibbonIcon: HTMLElement|null = null;

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
                "monitor-play",
                "Start Jupyter Server",
                this.plugin.env.toggle.bind(this.plugin.env)
            );
		}
        this.plugin.env.on(
            JupyterEnvironmentEvent.CHANGE,
            this.updateRibbon.bind(this)
        );

        // Show notices whenever the Jupyter environment status changes,
        this.plugin.env.on(
            JupyterEnvironmentEvent.CHANGE,
            this.showStatusMessage.bind(this)
        );

        // Display an error message when an error occurs
        this.plugin.env.on(
            JupyterEnvironmentEvent.ERROR,
            this.onEnvironmentError.bind(this)
        );

        // Let Obsidian know how to display Jupyter files
        this.plugin.registerView(
            "jupyter-view",
            (leaf) => new EmbeddedJupyterView(leaf, this.plugin)
        );

        // Let Obsidian know which file extensions are Jupyter notebooks
        this.plugin.registerExtensions(["ipynb"], "jupyter-view");
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
        if (this.serverRibbonIcon === null || !this.plugin.settings.displayServerRibbonIcon) {
            return;
        }

        switch (env.getStatus()) {
            case JupyterEnvironmentStatus.STARTING:
                setIcon(this.serverRibbonIcon as HTMLElement, "monitor-dot");
                setTooltip(this.serverRibbonIcon as HTMLElement, "Jupyter Server is starting");
                break;
            case JupyterEnvironmentStatus.RUNNING:
                setIcon(this.serverRibbonIcon as HTMLElement, "monitor-stop");
                setTooltip(this.serverRibbonIcon as HTMLElement, "Stop Jupyter Server");
                break;
            case JupyterEnvironmentStatus.EXITED:
                setIcon(this.serverRibbonIcon as HTMLElement, "monitor-play");
                setTooltip(this.serverRibbonIcon as HTMLElement, "Start Jupyter Server");
                break;
        }
    }

    private onEnvironmentError(_env: JupyterEnvironment, error: JupyterEnvironmentError) {
        if (error === JupyterEnvironmentError.JUPYTER_STARTING_TIMEOUT) {
            new JupyterModal(
                this.plugin.app,
                "Jupyter Timeout",
                [
                    "The Jupyter server took too long to start.",
                    "You can set in the settings the maximum time the plugin will wait for the server to start.",
                    "Your current timeout is set to " + (this.plugin.settings.jupyterTimeoutMs / 1000) + " second(s).",
                    this.plugin.settings.jupyterTimeoutMs < 15000 ? "This is a very short timeout and might not be enough for the server to start. Please try increasing it and see if the error disappears." : "This timeout seems reasonable, hence the problem might be elsewhere depending on your specific situation."
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
                this.plugin.app,
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
                this.plugin.app,
                "Jupyter crashed",
                [
                    "Jupyter crashed while starting",
                    "Use the button below to open the troubleshooting guide.",
                    "Here is the last log message from Jupyter:",
                    this.plugin.env.getLastLog()
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
                this.plugin.app,
                "Jupyter exited",
                [
                    "Jupyter crashed while starting but did not encounter an error.",
                    "This is a very rare case and might be due to an 'exit()' statement that got lost in your Jupyter configuration.",
                    "Use the button below to open the troubleshooting guide.",
                    "Here is the last log message from Jupyter:",
                    this.plugin.env.getLastLog()
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

    private configureJupyterEnvironment(
        env: JupyterEnvironment,
        settings: Settings,
        proxy: SettingsProxy<Settings>
    ): void {
        // We need each setting to be reactive so that the Jupyter
        // environment adapts on setting changes.
        proxy.on("change:debugConsole", (newVal, _oldVal) => {
            env.printDebugMessages(newVal);
        });
        // We also need to apply the initial settings to the environment.
        env.printDebugMessages(settings.debugConsole);

        proxy.on("change:pythonExecutable", (newVal, _oldVal) => {
            env.setPythonExecutable(
                newVal === PythonExecutableType.PYTHON
                    ? "python"
                    : settings.pythonExecutablePath
            );
        });
        proxy.on("change:pythonExecutablePath", (newVal, _oldVal) => {
            if (settings.pythonExecutable === PythonExecutableType.PATH) {
                env.setPythonExecutable(newVal);
            }
        });
        env.setPythonExecutable(
            settings.pythonExecutable === PythonExecutableType.PYTHON
                ? "python"
                : settings.pythonExecutablePath
        );

        proxy.on("change:jupyterTimeoutMs", (newVal, _oldVal) => {
            env.setJupyterTimeoutMs(newVal);
        });
        env.setJupyterTimeoutMs(settings.jupyterTimeoutMs);

        proxy.on("change:jupyterEnvType", (newVal, _oldVal) => {
            env.setType(newVal);
        });
        env.setType(settings.jupyterEnvType);

        proxy.on("change:useSimpleMode", (newVal, _oldVal) => {
            env.setUseSimpleMode(newVal);
        });
        env.setUseSimpleMode(settings.useSimpleMode);

        // Make sure that the ribbon icon is shown/hidden based on the setting
        proxy.on("change:displayServerRibbonIcon", (newVal, _oldVal) => {
            if (newVal) {
                this.serverRibbonIcon = this.plugin.addRibbonIcon(
                    "monitor-play",
                    "Start Jupyter Server",
                    this.plugin.env.toggle.bind(this.plugin.env)
                );
                this.updateRibbon(this.plugin.env);
            }
            else {
                this.serverRibbonIcon?.remove();
                this.serverRibbonIcon = null;
            }
        });
    }


    onunload(): void {
        
    }
}