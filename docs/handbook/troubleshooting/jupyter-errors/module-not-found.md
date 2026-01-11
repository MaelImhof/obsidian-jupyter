# Module Not Found

This error means Jupyter is not installed in the configured Python environment.

When displaying this error message, the plugin should also provide you with a command of the form:

```bash
# If you are using Jupyter Notebook
<python-executable> -m pip install notebook

# If you are using Jupyter Lab
<python-executable> -m pip install jupyterlab
```

where `<python-executable>` is the Python executable path that the plugin is configured to use to start Jupyter. Running the provided command should fix the problem by installing Jupyter in the corresponding Python environment.

::: info NOTE
The above commands may result in the following error:

```
<python-executable>: No module named pip
```

This means that `pip`, the Python package manager, is not installed in that Python environment. You can *usually* install it using

```bash
python3 -m ensurepip --upgrade
```

However, in certain environments such as Debian/Ubuntu, `ensurepip` is purposefully disabled, and you should either:

- **Recommended:** use [Python `venv`](https://docs.python.org/3/library/venv.html) (virtual environment) to create another Python environment and not mess with your system's top-level Python configuration. [Conda](https://conda.org/) also works for this use-case.

- **Discouraged:** install `pip` using the system's packet manager. In Debian/Ubuntu, it would be using

    ```bash
    sudo apt install python3-pip
    ```

Once you have `pip`, either in a different environment or in the original one, you can try the previous command again, with the new Python executable if you created a new environment.
:::

If running the above steps do not solve the issue, please [open a ticket](../index.md#opening-a-ticket).