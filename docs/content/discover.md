---
title: Discover the plugin's features
---
Jupyter for Obsidian is a simple plugin and does basically two things:

1. Run a Jupyter server for you (instead of opening a terminal and typing `jupyter [...]`)
2. Tell Obsidian how to open `.ipynb` files

This is a very minimal plugin, hence I'm interested in your [[index#Providing Feedback|feedback]] to build from here.
## Starting Jupyter

Opening `.ipynb` files inside of Obsidian still requires you to start a Jupyter server. Good news, the plugin can handle this for you.

There are three ways for you to start a Jupyter server:

1. Simply open a `.ipynb` file. By default, the plugin is [[settings#Start Jupyter automatically|configured]] to automatically run Jupyter before opening the file.
2. Use the ribbon icon, unless you have [[settings#Display ribbon icon|disabled it]].
3. Navigate to the settings of the plugin and use the [[settings#Server running|Server running]] setting to toggle the state of the Jupyter server.
## Configuring Jupyter
### Choosing Between Lab and Notebook

You can open your `.ipynb` files using either Jupyter Lab or Jupyter Notebook, depending on your preferences. You can change this behaviour using the setting [[settings#Jupyter environment type|Jupyter environment type]].
### Choosing the Python Executable

By default, the plugin will use a simply `python` shell command to run Jupyter. However, if you installed Jupyter in a Python virtual environment or with Conda/Miniconda, you'll want to change the Python executable.

You can do so by changing the setting [[settings#Python executable path|Python executable path]]. If you want to use an executable path instead of the `python` command, you must also ensure that [[settings#Python executable to use|Python executable to use]] is set to `Specified executable path`, otherwise the `python` command will still be used.

In particular, if you use Conda or Miniconda, see [[miniconda-and-conda|this guide]] to find the executable path you should use.
## Toggle Ribbon and Status Notices

By default, the plugin will show a ribbon icon allowing you to start and stop the Jupyter server in one click.

![[ribbon-icon.png]]

It will also display status notices to tell you how the server is doing. One will be displayed when the server is starting, running or has exited.

![[status-notices.png]]

You can disable both [[settings#Display ribbon icon|the ribbon icon]] and [[settings#Display status notices|the status notices]] individually using the two corresponding settings, if you do not find them necessary.