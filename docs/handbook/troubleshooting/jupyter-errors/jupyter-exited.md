# Jupyter Exited

This error message indicates that Jupyter stopped, but the plugin did not ask it to stop, and there was no sign of an encountered error.

1. Check your [Jupyter configuration files](https://jupyter-notebook.readthedocs.io/en/v6.4.6/config.html) if you have any, search for an `exit()` statement that would cause Jupyter to stop immediately.

1. For more advanced users, try [accessing the Jupyter logs](../../guides/access-jupyter-logs.md) and seeing if you can infer the root cause of the issue from those.

If the above steps do not solve the issue, please [open a ticket](../index.md#opening-a-ticket). Include logs as much as possible, while being mindful of what data you provide, since tickets can be viewed by anyone on the Internet, and logs often contain sensitive information such as your username, file paths, and other data you might want to remove before posting.
