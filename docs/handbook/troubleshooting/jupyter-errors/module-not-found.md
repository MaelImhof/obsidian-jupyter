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

If running that command does not solve the issue, please [open a ticket](../index.md#opening-a-ticket).