---
next: false
---

# Access Jupyter Logs

When encountering issues with the plugin or Jupyter, a good way to get more information about the problem in order to fix it is with logs.

::: info
Logs are automatic messages that a program (here, Jupyter) prints while it is running. They record what happens during execution and often contain important information about the causes for certain actions the program takes.
:::

To access Jupyter's logs:

1. Enable [*Print Jupyter output to Obsidian console*](../settings.md#print-jupyter-output-to-obsidian-console) at the very bottom of the plugin's settings in the [*Advanced*](../settings.md#advanced) section.

1. In your Obsidian vault, open the developer console by using `Ctrl` + `Shift` + `I` (on Windows or Linux) or `Command` + `Option` + `I` (on macOS).

1. Click on the `Default levels` dropdown in the top right of the window.

1. Click on `Verbose`.

1. The top-right dropdown should now read `All levels`, and the logs from Jupyter should be displayed in the console below (if any).

You now have access to the Jupyter logs. This can be helpful for getting more information in order to find the root cause of an issue.

Since you enabled logging in the plugin's settings not so long ago, there may be little to no logs in the console yet. Re-starting Jupyter will fix that.