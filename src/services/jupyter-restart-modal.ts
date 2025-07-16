import JupyterForObsidian from "@/jupyter-for-obsidian";
import { JupyterModal } from "@/services/jupyter-modal";

/**
 * Modal to ask whether the user wants to restart Jupyter to apply
 * some settings change.
 * 
 * Some settings require a Jupyter restart to apply, such as the Python
 * executable path or whether or not the plugin should automatically
 * delete the Jupyter checkpoints.
 * 
 * In those situations, this modal is displayed to ask the user
 * whether they want to restart Jupyter now or later.
 */
export class JupyterRestartModal extends JupyterModal {
    constructor(
        plugin: JupyterForObsidian,
        settingName: string
    ) {
        super(
            plugin.app,
            "Jupyter restart needed",
            [
                `You just changed the '${settingName}' setting.`,
                "To apply this change, you need to restart Jupyter. Note that restarting Jupyter could cause you to lose your current work if you have not saved it.",
                "Do you want to restart Jupyter now?"
            ],
            [
                {
                    text: "No, restart later",
                    onClick: () => { },
                    closeOnClick: true
                },
                {
                    text: "Yes, restart now",
                    onClick: (async () => {
                        await plugin.env.restart();
                    }),
                    closeOnClick: true
                }
            ]
        );
    }
}