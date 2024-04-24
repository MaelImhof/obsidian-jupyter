import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_EXAMPLE = "example-view";

export class ExampleView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_EXAMPLE;
  }

  getDisplayText() {
    return "Example view";
  }

  async onOpen() {
    this.containerEl.addClass("jupyter-view-container");
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("jupyter-view-container");
    container.createEl("iframe", {
        attr: {
            src: "http://localhost:8888"
        }
    }).addClass("jupyter-view-iframe");
  }

  async onClose() {
    // Nothing to clean up.
  }
}