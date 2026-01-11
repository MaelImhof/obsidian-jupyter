# Python Executable Not Found

This error message pops up when Jupyter cannot start because the Python executable specified in the settings cannot be found.

- If you are using the simple commands `python` or `python3` as executable, ensure the one you are using exists on your system.

    For example, `python` might not exist in certain environments while `python3` does, and inversely.

- If you are using a custom Python executable path, ensure it exists.

To check whether a particular executable path exists, you can try running it as a command in your terminal:

```bash
# Check whether "python" is a valid Python interpreter
python --version

# Check whether "python3" is a valid Python interpreter
python3 --version

# Check whether "/usr/bin/python3" is a valid Python interpreter
/usr/bin/python3 --version
```

If yours is a valid interpreter in your environment, it should print something along the lines of `Python 3.13.5`, possibly with a different version. If not, you should see something along the lines of

```
<python executable>: command not not found
```

for example:

```
/usr/bin/python3: No such file or directory
```

In such a case, the Python executable path you are using is invalid and needs to be replaced for the plugin to be able to start a Jupyter environment.

To fix the issue and find the path to use, follow [this guide](../../guides/find-python-executable.md).

If the guide does not solve the problem, [open a ticket](../index.md#opening-a-ticket).

::: details Technical details
The `Python Executable Not Found` error is caused by [`child_process.spawn`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options) when the `error` event is fired with an `ENOENT` code.

This `ENOENT` either means the provided command (aka the Python executable) does not exist, or that the provided working directory is invalid. In the case of *Jupyter for Obsidian*, the second case is unlikely, since the working directory provided to the `spawn` function is the Obsidian vault's root and is expected to be valid at all times.

Thus, it is assumed that when receiving this error code, the problem comes from a faulty executable.
:::