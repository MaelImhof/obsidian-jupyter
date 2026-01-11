# Spawning Error

This error message is a safeguard that is expected to never be displayed in a practical scenario.

If you have nevertheless been presented with that error:

1. Check that the configured Python executable is valid and works in the terminal. [This guide](../../guides/find-python-executable.md) can help you determine what your Python executable path should be.

1. Check that Jupyter is installed in the provided Python environment. Depending on your [*Jupyter environment type*](./settings.md#jupyter-environment-type), you will want to check Jupyter Lab or Jupyter Notebook in particular. You can do this using the command

    ```bash
    # If using Jupyter Lab
    <python executable> -m jupyterlab

    # If using Jupyter Notebook
    <python executable> -m notebook
    ```

    and see if Jupyter starts normally.

If the above steps do not fix the problem, please [open a ticket](../index.md#opening-a-ticket).

::: details Technical details
This error message is displayed if [Node's `child_process.spawn` function](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options), which is used to start Jupyter as a child process, throws an error synchronously.

According to the documentation, if an error occurs while spawning a program, it will be dispatched through the `error` event of the returned child process instance. No mention is made of a synchronous `throw`. Hence, this error is not expected to be met in practice.
:::