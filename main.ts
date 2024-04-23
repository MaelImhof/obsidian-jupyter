import { Notice, Plugin, TFolder } from "obsidian";

export default class JupyterNotebookPlugin extends Plugin {
    async onload() {
		// Register a context menu item for folders to launch a Jupyter Notebook
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFolder) {
					menu.addItem((item) => {
						item
							.setTitle("Start Jupyter Notebook")
							.setIcon("document")
							.onClick(async () => {
								new Notice("Starting Jupyter Notebook");
							});
					});
				}
			})
		);
	}
}