import { ButtonComponent } from 'obsidian';

/** A button rendered alongside a Jupyter status message. */
export interface JupyterMessageAction {
	text: string;
	onClick: () => void;
}

/**
 * Renders a centered status message (header, text, optional action button)
 * inside `container`.
 *
 * Shared by the full notebook tab view (`EmbeddedJupyterView`) and the
 * embed view (`NotebookEmbedChild`), so Jupyter's "starting"/"not
 * running"/etc. messages look similar everywhere (centered via the
 * `jupyter-message-container` class) regardless of the surrounding DOM
 * context.
 *
 * Note that differences in style still exist because of the different
 * styling inherited from the surrounding context (e.g. live preview text is
 * smaller than reading mode text). These differences are kept for coherence,
 * but the layout (centered title, message and button) is the same.
 */
export function renderJupyterMessage(
	container: HTMLElement,
	headingTag: 'h1' | 'h2' | 'h3' | 'h4',
	header: string,
	text: string,
	action?: JupyterMessageAction
): { containerEl: HTMLElement; headerEl: HTMLElement; textEl: HTMLElement } {
	const messageContainerEl = container.createDiv();
	messageContainerEl.addClass('jupyter-message-container');

	const headerEl = messageContainerEl.createEl(headingTag);
	headerEl.addClass('jupyter-message-header');
	headerEl.setText(header);

	const textEl = messageContainerEl.createEl('p');
	textEl.addClass('jupyter-message-text');
	textEl.setText(text);

	if (action) {
		const button = new ButtonComponent(messageContainerEl);
		button.setButtonText(action.text);
		button.onClick(action.onClick);
	}

	return { containerEl: messageContainerEl, headerEl, textEl };
}
