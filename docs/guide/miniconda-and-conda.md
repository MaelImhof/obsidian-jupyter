# Run From Conda or Miniconda

If you installed Python with Conda or Miniconda, you will need to configure the plugin accordingly before being able to use it.

## Find Python Executable

First, you'll need to find the Python executable path of the Conda environment you want to use (most likely the environment where you installed Jupyter).

Use the instructions provided by the [Anaconda documentation](https://www.anaconda.com/docs/tools/working-with-conda/ide-tutorials/python-path#finding-your-anaconda-python-interpreter-path) and copy the executable path that it gives you.

## Configure the Plugin

Once you have the right Python executable path, paste it as the value of the [Python executable path](./settings.md#python-executable-path) setting. This will tell the plugin that Python has to be run from this place.

Also set [Python executable to use](./settings.md#python-executable-to-use) to `Specified executable path` so that the path you used above is taken into consideration by the plugin.

And voilà ! You should be able to run your Jupyter environment from Conda or Miniconda.

If you encounter any problem, please see the [troubleshooting guide](./troubleshooting.md).