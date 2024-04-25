import { FileView, ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import JupyterNotebookPlugin from "./jupyter-obsidian";

export const JUPYTER_VIEW_TYPE = "jupyter-view";

export class EmbeddedJupyterView extends FileView {

    private webviewEl: HTMLElement | null = null;

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

        this.contentEl.empty();

        const doc = this.contentEl.doc;
        this.webviewEl = doc.createElement("webview");
        this.webviewEl.setAttribute("allowpopups", "");
        // @ts-ignore
        this.webviewEl.setAttribute("partition", "persist:surfing-vault-" + this.app.appId);
        this.webviewEl.addClass("jupyter-webview");
        this.webviewEl.setAttribute("src", `http://localhost:${this.plugin.env.getPort()}/notebooks/${file.path}/?token=${this.plugin.env.getToken()}`);
    }
}