# Getting Started

Hi !

Want to transparently open `.ipynb` files in Obsidian? Run your Jupyter notebooks directly inside Obsidian? You are at the right place!

![Screenshot of Jupyter for Obsidian in action](/images/jupyter-inside-obsidian.png)

## Beta Relases

This Obsidian plugin is in beta at the moment. I want to gather feedback and improve it before releasing it as an Obsidian community plugin.

- **The plugin should already be working.**

    You can open `.ipynb` files, run a Jupyter server, tweak the parameters to adapt the plugin for your use case, ...

- **Some bugs might have gone unnoticed until now.**

    Although I tested the plugin thoroughly myself, it might behave unexpectedly on different environments, that's why I need beta testers, to see if it works for them as well.

- **Please give me feedback.**

    Tell me what you like, what you don't, what you *would* like, anything. I'll see what I can do.

## Installing the plugin

Since Jupyter for Obsidian is not available as an Obsidian community plugin for now, you will need the [BRAT plugin](https://tfthacker.com/brat-quick-guide) to install it.

1. Backup your vault!

2. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin from the Obsidian community plugins list, as any other plugin.

    ![Screenshot of BRAT in the Obsidian community plugins list](/images/install-brat.png)

3. Go in BRAT settings and click `Add Beta plugin`.

    ![Screenshot of the BRAT settings with the button to click](/images/add-beta-plugin.png)

4. Fill in the displayed form.

    - Use `https://github.com/MaelImhof/obsidian-jupyter` for the repository URL.
    - Since the repository is public, you do not need to fill in the second field that reads `GitHub API key`.
    - In the dropdown below, select `Latest version` so that BRAT automatically updates the plugin when a new version comes out.
    - Tick `Enable after installing the plugin` if not already ticked.
    - Click `Add Plugin`.
    
    ![Screenshot of the fields to fill in to install the plugin in beta](/images/brat-new-plugin-form.png)

5. Voilà! The plugin should now be installed in your vault. Use it as a normal plugin and **provide feedback** about the beta.

> [!WARNING]
> Due to changes in how BRAT handles releases, older versions of Jupyter for Obsidian (before `0.6.1-beta`) will probably cause an error if using BRAT 1.1.4 or newer. See [this issue on GitHub](https://github.com/MaelImhof/obsidian-jupyter/issues/105).

## Providing Feedback

Once the plugin is installed, you can start using it normally in your Obsidian vault. Discover the [features of the plugin](./features.md) and try playing a bit with it, see how it integrates with your workflow.

Please send me feedback about your experience with the plugin! This would help me a lot improving and releasing it in the official list of Obsidian community plugins.

To share feedback, choose between the following, depending on your preference and convenience.

- Participate on [this Obsidian forum post](https://forum.obsidian.md/t/jupyter-notebook-integration-for-obsidian/4951/40), I'll be monitoring new comments.
- Open an [issue on GitHub](https://github.com/MaelImhof/obsidian-jupyter/issues).
- Join the [Discord server](https://discord.gg/KgkwwRJ3mQ) I quickly put together for the occasion.

Thank you in advance for your time, I hope you'll like the plugin!