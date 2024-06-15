---
title: Settings
---
You can configure several aspects of the plugin such as the Python executable to start Jupyter or whether or not to display a ribbon icon.

A rundown of all the settings is available here.
## Available Settings
### Python
#### Python executable to use

Whether to use the simple `python` command to start Jupyter, or a particular Python executable file.

If set to `Specified executable path`, the [[#Python executable path]] setting will be used.

Set to `python` by default.
#### Python executable path

The Python executable path to use to start Jupyter. This setting has no effect if [[#Python executable to use]] is set to `python`.

Empty by default.
### Jupyter
#### Server running

Not a setting properly speaking, this toggle indicates the state of the server. If the server is starting or running, the toggle is `on`. If the server has exited or has not been started, the toggle is `off`.
#### Start Jupyter automatically

Whether to automatically start the Jupyter server when a `.ipynb` file is opened if Jupyter is not running.

Default value is yes.
#### Jupyter environment type

Whether to use Jupyter Lab or Jupyter Notebook.

Note that if the Jupyter server is running while you change this setting, you will need to stop it and start it again for the new value to take effect.

Default value is Jupyter Lab.
#### Delete Jupyter checkpoints

When working with notebooks, Jupyter generates checkpoint files. This creates a new `.ipynb_checkpoints` directory in each directory where you have a notebook opened. It becomes messy very fast.

This setting helps you keeping your vault clean. If enabled, checkpoints will be deleted automatically.

The deletion does not work retroactively though, meaning that if checkpoints were created before you enable the feature, they won't be deleted. The setting only applies to future checkpoints.

Note that if the Jupyter server is running while you change this setting, you will need to stop it and start it again for the new value to take effect.

This setting is disabled by default.
#### Move Jupyter checkpoints to trash

If enabled, Jupyter checkpoints will be moved to the system trash instead of being permanently deleted. This can be useful if you want to still make sure you can always restore checkpoints.

This setting has no effect if [[#Delete Jupyter checkpoints]] is disabled.

By default, Jupyter checkpoints are moved to trash (enabled).
### Plugin customization
#### Display ribbon icon

Whether to display the plugin's ribbon icon or not. Can help if you find the ribbon icon unnecessary and want to get rid of it.

![[ribbon-icon.png]]

Default value is yes (the ribbon icon is displayed).
#### Display status notices

Whether to display status notices when the Jupyter server state updates. A notice will appear every time the server is started, running, or exits. 

![[status-notices.png]]

Default value is yes (the status notices are displayed).
### Advanced
#### Jupyter starting timeout

Number of seconds to wait before Jupyter is considered to time out in the starting state. If Jupyter takes too long to get ready, it will be shutdown and an error will be displayed.

This setting is to avoid Jupyter staying in the starting state for too long. Please note that making this setting too low might prevent Jupyter to even have the time to start at all.

Default value is 30 seconds.
#### Print Jupyter output to Obsidian console

Whether to print what Jupyter prints to the Obsidian console.

When Jupyter is started from a terminal, it prints many setup and log messages, which can be interesting for debugging, understanding a problem, or get the Jupyter URL and token to access it in a browser. This setting allows you to print all of those messages to the [Obsidian console](https://help.obsidian.md/Help+and+support#Capture+console+logs).

Default value is no (nothing will be printed).