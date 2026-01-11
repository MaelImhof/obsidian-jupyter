import { App, ButtonComponent, Component, MarkdownRenderer, Modal, Setting } from 'obsidian';

/** Contract to define what a button should do and look like. */
export interface JupyterModalButton {
	text: string;
	onClick: () => void;
	closeOnClick: boolean;
}

/**
 * Contract to indicate that the contained string should be rendered as markdown
 * instead of simply plain text.
 */
export interface JupyterModalMarkdown {
	markdown: string;
}

/**
 * Base class for modals used by the Jupyter plugin. Simple modal with
 * a title, a message and a set of buttons.
 */
export class JupyterModal extends Modal {
	private readonly component: Component = new Component();

	constructor(
		app: App,
		private readonly heading: string,
		private readonly message: (string | JupyterModalMarkdown)[],
		private readonly buttons: JupyterModalButton[]
	) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.createEl('h1', { text: this.heading });
		for (const message of this.message) {
			if (typeof message === 'string') {
				this.contentEl.createEl('p', { text: message });
			} else {
				let divContainer = this.contentEl.createDiv();
				divContainer.style.overflowX = 'scroll';
				void MarkdownRenderer.render(
					this.app,
					message.markdown,
					divContainer,
					this.app.vault.getRoot().path,
					this.component
				);
			}
		}
		if (this.buttons.length > 0) {
			let setting = new Setting(this.contentEl);
			this.buttons.forEach(
				((button: JupyterModalButton) => {
					setting.addButton(
						((buttonEl: ButtonComponent) => {
							buttonEl.setButtonText(button.text);
							buttonEl.onClick(() => {
								button.onClick();
								if (button.closeOnClick) {
									this.close();
								}
							});
						}).bind(this)
					);
				}).bind(this)
			);
		}
	}

	onClose(): void {
		this.component.unload();
	}
}
