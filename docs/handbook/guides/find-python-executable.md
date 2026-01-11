---
prev: false
---

# Find your Python executable

The *Jupyter for Obsidian* plugin works by starting a Jupyter instance for you, automatically, instead of you going to your terminal and starting it manually.

While it provides a smoother experience once set up, it requires that the plugin knows which Python executable to use. This can be configured in the plugin's settings using [*Python executable to use*](../settings.md#python-executable-to-use) and, for Python environments, [*Python executable path*](../settings.md#python-executable-path).

This guide aims at helping you to find out what your Python executable is, and configure the plugin accordingly.

## Generic Guide

The simplest way to find your Python executable is:

1. Open a new terminal

1. Start Jupyter (either Jupyter Lab or Jupyter Notebook is fine) from that terminal, manually. This generally means activating an environment if you are using one, and running a command such as

    ```bash
    jupyter
    ```

    or

    ```bash
    python -m jupyterlab
    ```

    Ensure Jupyter is able to start, then stop it.

1. Still in the same terminal, run the following command:

    ```bash
    python -c "import sys; print(sys.executable)"
    ```

    ::: tip
    If the command fails with a message such as
    
    ```
    python: command not found
    ```
    
    try replacing `python` with `python3`.
    :::

    This will run a super-short Python script whose sole purpose is to print the Python executable's path.

    You will get a path printed in the terminal. Some examples of what it might look like include:

    ```
    C:\Users\<username>\AppData\Local\Programs\Python\Python3x\python.exe

    /usr/bin/python3
    /home/<username>/some/directory/.venv/bin/python

    /Users/<username>/anaconda/bin/python
    ```

    Copy this path, we will use it in the following steps.

1. Open the settings of the *Jupyter for Obsidian* plugin.

1. In the [*Python*](../settings.md#python) section, set the [*Python executable to use*](../settings.md#python-executable-to-use) setting to the value `Specified executable path`.

1. Still in the [*Python*](../settings.md#python) section, paste the path from before into the [*Python executable path*](../settings.md#python-executable-path) setting.

1. Restart the Jupyter environment from within Obsidian if needed.

The plugin should now be using the specified Python executable/environment to run Jupyter. If something is still not working, please refer to the [troubleshooting guide](../troubleshooting/index.md) or [open a ticket](../troubleshooting/index.md#opening-a-ticket) directly.

## Using Conda or Miniconda

If you are using Conda or Miniconda to manage the Python environment where Jupyter is installed, a second method to find your Python executable path is to follow the instructions in their documentation, though the [generic guide](#generic-guide) should also work fine.

1. Find the Python executable path of the Conda environment using the instructions provided by the [Anaconda documentation](https://www.anaconda.com/docs/tools/working-with-conda/ide-tutorials/python-path#finding-your-anaconda-python-interpreter-path) and copy the executable path that it gives you.

1. Open the settings of the *Jupyter for Obsidian* plugin.

1. In the [*Python*](../settings.md#python) section, set the [*Python executable to use*](../settings.md#python-executable-to-use) setting to the value `Specified executable path`.

1. Still in the [*Python*](../settings.md#python) section, paste the path from before into the [*Python executable path*](../settings.md#python-executable-path) setting.

1. Restart the Jupyter environment from within Obsidian if needed.

And voilà! The plugin should now be able to run Jupyter from your Conda or Miniconda environment.

If you encounter any problem, please refer to the [troubleshooting guide](../troubleshooting/index.md) or [open a ticket](../troubleshooting/index.md#opening-a-ticket) directly.