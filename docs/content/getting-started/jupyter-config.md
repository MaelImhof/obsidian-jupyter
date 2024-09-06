---
title: Configure Jupyter
---
Jupyter for Obsidian uses its own instance of Jupyter, meaning that you won't have to open a terminal and start Jupyter manually.

This is very practical, however it also means you have to tell the plugin how you want it to run Jupyter. You can do so in the plugin's settings. A detailed documentation of all the available settings is available on the [[settings|dedicated page]], but this *Getting Started* guide covers most of them with more context.

## Jupyter Environment Type

Most obvious setting is to tell the plugin whether to use **Jupyter Lab** or **Jupyter Notebook**, depending on your personal preferences. You can do so by setting the appropriate dropdown setting to your liking.

> [!NOTE]
> If the plugin already launched Jupyter, you will have to stop Jupyter and start it again for the changed setting to take effect.
> 
> Starting and stopping Jupyter is explored further in the guide, so stay with us!

## Python Executable Path

This is where the configuration gets the most tricky, so please bear with me.

Think about how you start Jupyter when doing it yourself from the terminal. What commands do you use? Do you use a single, simple `python` command or `jupyter` command, or do you first need to enable a Python virtual environment (`venv`, `conda`, any other type of environment)?

## Using `python` Executable

If you use a single, simple command, then you should be good with the default configuration. By default, Jupyter for Obsidian uses the plain `python` command to start Jupyter.

This, however, won't work if Jupyter is installed in a virtual or Conda environment.

## Virtual or Conda Environment

If your Jupyter installation lies in a virtual or Conda environment, you will need to provide the Python executable file path of that environment.

### `venv` Environment

If you used `python -m venv venv` to create your virtual environment, the Python interpreter, or Python executable file, should be located in `path/to/.venv/Scripts/python.exe`, or similar for non-Windows machines.

### Conda Environment

Anaconda provide detailed instructions 

