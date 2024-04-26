import { FileView, ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import JupyterNotebookPlugin from "./jupyter-obsidian";
import { JupyterEnvironment, JupyterEnvironmentEvent, JupyterEnvironmentStatus } from "./jupyter-env";

export const JUPYTER_VIEW_TYPE = "jupyter-view";

export class EmbeddedJupyterView extends FileView {

    private messageContainerEl: HTMLElement | null = null;
    private messageHeaderEl: HTMLElement | null = null;
    private messageTextEl: HTMLElement | null = null;
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

    private displayMessage(header: string, text: string, clear: boolean = true): void {
        if (clear) {
            this.contentEl.empty();
        }
        this.messageContainerEl = this.contentEl.createDiv();
        this.messageContainerEl.addClass("jupyter-message-container");
        this.messageHeaderEl = this.messageContainerEl.createEl("h2");
        this.messageHeaderEl.addClass("jupyter-message-header");
        this.messageHeaderEl.setText(header);
        this.messageTextEl = this.messageContainerEl.createEl("p");
        this.messageTextEl.addClass("jupyter-message-text");
        this.messageTextEl.setText(text);
    }
    
    async onLoadFile(file: TFile) {

        // If the Jupyter environment is not running, we need to start it first
        switch (this.plugin.env.getStatus()) {
            case JupyterEnvironmentStatus.EXITED:

                // The user can disable Jupyter auto-start in the settings
                if (!this.plugin.settings.startJupyterAuto) {
                    this.displayMessage("No Jupyter server", "Jupyter does not seem to be running. Please make sure to start the server manually using the plugin's ribbon icon or settings. You can also enable automatic start of the Jupyter server when a document is opened in the settings.");
                    return;
                }

                // If Jupyter auto-start is enabled, start the server
                this.plugin.env.start();
                // Keep going to the STARTING instructions
            case JupyterEnvironmentStatus.STARTING:
                this.plugin.env.once(JupyterEnvironmentEvent.READY, (async (_env: JupyterEnvironment) => await this.onJupyterRunning(file)).bind(this));
                this.displayMessage("Jupyter is starting", "The Jupyter server is not ready yet. Your document will be opened shortly.");
                break;
            case JupyterEnvironmentStatus.RUNNING:
                await this.onJupyterRunning(file);
                break;
            default:
                this.displayMessage("Unknown error", "An unknown error has happened when loading the file. Please try re-opening it.");
                break;
        }
    }

    async onJupyterRunning(file: TFile) {
        // Check the Jupyter environment is indeed running
        if (!this.plugin.env?.isRunning()) {
            this.displayMessage("Unknown error", "An unknown error has happened when loading the page. Please try re-opening it.");
            console.debug("Exiting onJupyterRunning because Jupyter is not running.");
            return;
        }

        this.contentEl.empty();

        this.displayMessage("Loading " + file.name, "Your file will be displayed shortly.");
        
        // @ts-ignore
        this.webviewEl = this.contentEl.createEl("webview");
        this.webviewEl.setAttribute("allowpopups", "");
        // @ts-ignore
        this.webviewEl.setAttribute("partition", "persist:surfing-vault-" + this.app.appId);
        this.webviewEl.addClass("jupyter-webview", "jupyter-webview-loading");
        this.webviewEl.setAttribute("src", this.plugin.env.getFileUrl(file.path) as string);
        this.webviewEl.addEventListener("dom-ready", ((_event: any) => {
            this.messageContainerEl?.remove();
            this.messageContainerEl = null;
            this.messageHeaderEl?.remove();
            this.messageHeaderEl = null;
            this.messageTextEl?.remove();
            this.messageTextEl = null;
            this.webviewEl?.removeClass("jupyter-webview-loading");
        }).bind(this));
    }
}