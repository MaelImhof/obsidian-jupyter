import JupyterForObsidian from "@/jupyter-for-obsidian";
import { IFeature } from "../plugin-feature";
import { registerDeleteCheckpointsSettings } from "./delete-checkpoints-settings";
import { getDefaultCheckpointsRootFolder, purgeJupyterCheckpoints } from "./jupyter-checkpoints-utils";
import { JupyterEnvironment, JupyterEnvironmentEvent } from "@/services/jupyter-environment";
import { getPluginFolder } from "@/services/path-utils";
import { customJupyterConfigExists, generateJupyterConfig } from "./jupyter-config-utils";

export class DeleteCheckpointsFeature implements IFeature {
    private plugin: JupyterForObsidian;

    async onload(plugin: JupyterForObsidian): Promise<void> {
        this.plugin = plugin;

        // Whenever the Jupyter environment exits, we purge the checkpoints
        this.plugin.env.on(JupyterEnvironmentEvent.EXIT, this.onJupyterExit.bind(this));

        // If the user has enabled checkpoints deletion, we want to set up
        // the custom Jupyter configuration before starting Jupyter.
        this.plugin.env.on(JupyterEnvironmentEvent.ABOUT_TO_START, this.setupBasedOnSettings.bind(this));

        // Register the settings UI for this feature
        registerDeleteCheckpointsSettings(
            this.plugin.settingsTab,
            getDefaultCheckpointsRootFolder()
        )
    }

    private async setupBasedOnSettings(): Promise<void> {
        if (this.plugin.settings.deleteCheckpoints) {
            this.plugin.env.setCustomConfigFolderPath(
                getPluginFolder().getAbsolutePath()
            );
            if (!await customJupyterConfigExists(this.plugin)) {
                await generateJupyterConfig(this.plugin);
            }
        }
        else {
            this.plugin.env.setCustomConfigFolderPath(null);
        }
    }

    private async onJupyterExit(_env: JupyterEnvironment): Promise<void> {
        await purgeJupyterCheckpoints(this.plugin);
    }

    onunload(): void {
        // TODO: Maybe await this somehow, make it synchronous?
        purgeJupyterCheckpoints(this.plugin);
    }
}