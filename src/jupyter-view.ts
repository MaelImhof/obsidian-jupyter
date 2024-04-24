import { FileView, ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import JupyterNotebookPlugin from "./jupyter-obsidian";

export const JUPYTER_VIEW_TYPE = "jupyter-view";

export class EmbeddedJupyterView extends FileView {

    constructor(leaf: WorkspaceLeaf, private plugin: JupyterNotebookPlugin) {
        super(leaf);
    }

    getViewType(): string {
        return JUPYTER_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Jupyter Embedded View";
    }
    
    async onLoadFile(file: TFile) {
        if (this.plugin.env === null) {
            new Notice("Jupyter environment is not running");
            return;
        }

        this.containerEl.addClass("jupyter-view-container");
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass("jupyter-view-container");
        container.createEl("iframe", {
            attr: {
                src: `http://localhost:${this.plugin.env.getPort()}/notebooks/${file.path}/?token=${this.plugin.env.getToken()}`
            },
            
        }).addClass("jupyter-view-iframe");
    }
}