---
title: Troubleshooting
---
Here is a quick guide on possible fixes you can try to fix existing errors before asking for help.

- [[#Existing Errors Codes]]
	- [[#Jupyter process could not be spawned]]
	- [[#Jupyter process crashed]]
	- [[#Jupyter process exited]]
	- [[#Jupyter Timeout]]
- [[#Opening a Ticket]]
## Existing Errors Codes
### Jupyter process could not be spawned

Indicates that at the instant Jupyter is run, a problem occurs and Jupyter either never starts or crashes instantly.

1. Check the provided [[settings#Python executable to use|Python executable to use]] is valid and that the [[settings#Python executable path|path]] is set correctly if not using `python`.
2. Check that Jupyter is installed in the provided Python environment. Depending on your [[settings#Jupyter environment type|Jupyter environment type]], you will want to check Jupyter Lab or Jupyter Notebook in particular. You can do this using the command `[python_executable] -m [notebook or jupyterlab]` and see if Jupyter starts normally.

If both Python and the right Jupyter environment are installed, please [[#Opening a Ticket|open a ticket]].
### Jupyter process crashed

Indicates that Jupyter was started but then crashed before being fully ready to open `.ipynb`.

1. Check that Jupyter is installed in the provided Python environment. Depending on your [[settings#Jupyter environment type|Jupyter environment type]], you will want to check Jupyter Lab or Jupyter Notebook in particular. You can do this using the command `[python_executable] -m [notebook or jupyterlab]` and see if Jupyter starts normally.

If the right Jupyter environment is installed, please [[#Opening a Ticket|open a ticket]].
### Jupyter process exited

Very rare case that indicates Jupyter exited while starting, but did not encounter any error. This means the Jupyter process exited with a `0` exit code, meaning the program exited normally.

1. Check for an `exit()` statement lost in your [Jupyter configuration file](https://jupyter-notebook.readthedocs.io/en/v6.4.6/config.html) if you have one.
2. For more advanced users, you can [[settings#Print Jupyter output to Obsidian console|enable Jupyter logging]] and try debugging the issue from the messages Jupyter gives you.

If none of those work, please [[#Opening a Ticket|open a ticket]].
### Jupyter Timeout

Indicates Jupyter was started and worked in the background for too long, thus it was considered that something was wrong.

1. Check the value of your [[settings#Jupyter starting timeout|Jupyter starting timeout]] and try to increase it. This defines for how long to wait before considering Jupyter to be timing out. If set too low, this can prevent Jupyter from ever starting.

If increasing the Jupyter starting timeout to the maximum possible value does not work for you, please run Jupyter manually from the terminal, record how long it takes from the moment you enter the command to the moment Jupyter opens your browser. Then [[#Opening a Ticket|open a ticket]] where you indicate the measured time.
## Opening a Ticket

If none of the fixes above work for you, you can request help using

- [**GitHub issues**](https://github.com/MaelImhof/obsidian-jupyter/issues)
  Choose the issue template that seems appropriate to you. By default you'll want to use **Ask for help**.
- [**Discord server**](https://discord.gg/KgkwwRJ3mQ)
  Join the Discord server and ask your questions in the home channel.

Your feedback and bug reports will help improve the plugin, thank you !