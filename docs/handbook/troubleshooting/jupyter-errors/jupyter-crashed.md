# Jupyter Crashed

This error message indicates that Jupyter stopped and said it encountered an error. The exact nature of the error can be inferred from the Jupyter logs if available.

1. Check that Jupyter is installed in the provided Python environment.

    Depending on your [*Jupyter environment type*](./settings.md#jupyter-environment-type), you will want to check Jupyter Lab or Jupyter Notebook in particular.

    Use the following commands in your Python environment:
    
    ```bash
    # If you are using Jupyter Lab
    <python-executable> -m jupyterlab --version

    # If you are using Jupyter Notebook
    <python-executable> -m notebook --version
    ```

    If the command outputs a version looking something like `4.5.1` or `7.5.1` (the numbers might be different, but the format should bee similar), then the modules are installed.

    If you get an error such as:

    ```
    <python-executable>: No module named notebook
    ```

    Then **Jupyter Notebook is not installed in that Python environment**. Similar for Jupyter Lab. In that case, try [installing them](./module-not-found.md) first and see if that fixes the issue.

    If not, proceed to the next steps.

1. Follow [this guide](../../guides/access-jupyter-logs.md) to get access to Jupyter's logs.

1. Try starting Jupyter using your preferred method (ribbon icon, command, ...) and see the Jupyter logs get printed in real-time in the Obsidian console.

1. Use the logs to find out what the problem was that caused Jupyter to crash. It might be a misconfiguration or an outdated plugin.

Copying and pasting the logs into a large language model such as ChatGPT or Gemini may help in finding and fixing the issue. Be mindful of what data you provide to those services. Logs may contain file paths, your username, custom data you configured Jupyter with, and other information you may want to keep private.

If you need help fixing the issue, please [open a ticket](../index.md#opening-a-ticket). Include logs as much as possible, while still being mindful of what data you provide, since tickets can be viewed by anyone on the Internet.
