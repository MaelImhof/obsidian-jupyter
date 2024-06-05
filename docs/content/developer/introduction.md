---
title: Developer Documentation
---
Hi, welcome in the developer documentation, which is about documenting the code of the plugin so it is easy to understand for contributors.
## High-Level Idea

The plugin is based on a simple idea :

> I open Jupyter in a browser. Obsidian is based on Chromium and there exists an Obsidian plugin to display web pages. So it must be possible to open Jupyter web pages directly in Obsidian.

Nothing more. Pretty simple huh?
## General Architecture

Now, the idea must be translated to a working system. Since it is an Obsidian plugin, some common Obsidian features will appear in our system.

1. **Jupyter environment :** we want to programmatically start Jupyter without the user having to open a terminal, and manage the Jupyter instance automatically.
2. **Jupyter file view :** in Obsidian, a file view is what displays a file in the editor. We want to display a web page instead, so we need a custom view.
3. **UI components :** in addition to the Jupyter file view, we want to have more UI components to tell the user about the status of the server, so that it is always clear what Jupyter is doing.
4. **Settings :** we want the user to be able to customize the experience and make it correspond to a particular situation.
5. **Bandleader :** who makes all the previous parts work together.
## Translating to Code

This general system architecture was translated into TypeScript code as follows.

1. The **`jupyter-env.ts`** file is the backend of the plugin. It starts and stops the Jupyter environment and provide event callbacks when the server starts, exits or encounters an error. It knows the Jupyter token and port in order to access files.
2. The **`jupyter-view.ts`** file is the Jupyter file view that allows Obsidian to render `.ipynb` files.
3. The **`jupyter-modal.ts`** file is a dialog window used to display error messages when need be. Other UI tweaks are contained in `jupyter-obsidian.ts` (notices, ribbon icon).
4. The **`jupyter-settings.ts`** defines the settings type of the plugin but also its settings page.
5. Finally, the **`jupyter-obsidian.ts`** contains the common main plugin class of Obsidian plugins, and puts everything together. It registers the custom view, the settings page, a ribbon icon. It displays messages when the server changes state or when there is an error.
## Specific Documentation

This was a very quick introduction, but since the plugin codebase is not too complex, I hope this and some in-code documentation will do the trick. Do not hesitate to reach out on [Discord](https://discord.gg/KgkwwRJ3mQ) or [GitHub](https://github.com/MaelImhof/obsidian-jupyter/issues) if you need more information.

Happy coding !