# Jupyter for Obsidian

Run and use Jupyter Notebook or Jupyter Lab without ever leaving Obsidian. Open `.ipynb` files in the Obsidian editor, edit them, run them with ease.

For more information, please refer to the documentation website [https://jupyter.mael.im](https://jupyter.mael.im).

## Structure of the repository

> [!NOTE]
> `main.js`, `manifest.json` and `versions.json` are in `test-vault/.obsidian/plugins/jupyter/`. They are copied to the root directory when running `npm run build`.

- **`docs`** contains a [Quartz](https://github.com/jackyzha0/quartz) installation used to generate the documentation website.
- **`src`** contains the TypeScript code for the plugin.
- **`test-vault`** contains a test Obsidian vault. Run `npm run dev` to watch for changes and update the plugin in this vault when needed. The hot-reload plugin is also installed, such that the Jupyter plugin will automatically be reloaded.
