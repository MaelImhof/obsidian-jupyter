import { App, ButtonComponent, Modal, Setting } from "obsidian";

export interface JupyterModalButton {
    text: string;
    onClick: () => void;
    closeOnClick: boolean;
}

export class JupyterModal extends Modal {
    constructor(
        app: App,
        private readonly heading: string,
        private readonly message: string[],
        private readonly buttons: JupyterModalButton[]
    ) {
        super(app);
    }

    onOpen(): void {
        this.contentEl.createEl("h1", { text: this.heading });
        for (const message of this.message) {
            this.contentEl.createEl("p", { text: message });
        }
        if (this.buttons.length > 0) {
            let setting = new Setting(this.contentEl);
            this.buttons.forEach(((button: JupyterModalButton) => {
                setting.addButton(((buttonEl: ButtonComponent) => {
                    buttonEl.setButtonText(button.text);
                    buttonEl.onClick(() => {
                        button.onClick();
                        if (button.closeOnClick) {
                            this.close();
                        }
                    });
                }).bind(this));
            }).bind(this));
        }
    }
}