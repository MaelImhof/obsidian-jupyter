---
next: false
---

# Jupyter Timeout

This error message indicates Jupyter took too long to start and was considered stuck.

Sometimes, programs get stuck in a loop and never stop running, but do not make any progress. For this reason, *Jupyter for Obsidian* enforces a timeout by default, after which Jupyter is considered stuck and gets stopped.

::: info NOTE
The time it takes for Jupyter to start will depend on hardware, system load, and other factors.
:::

1. Check the value of the [*Jupyter starting timeout*](../../settings.md#jupyter-starting-timeout) setting and try increasing it. This defines how long to wait before considering Jupyter to be stuck.

    Jupyter needs some time to start (which is completely normal and expected). If the timeout in your settings is too low, Jupyter might simply never have the time to start before the timeout is reached.

1. If even the maximum timeout is not enough, try setting the timeout to `0` (which effectively disables the timeout entirely) and see if you Jupyter ends up successfully starting after a few minutes.

1. Try starting Jupyter manually from the terminal and record how much time it takes to start using a stopwatch.

1. If Jupyter takes more than a few minutes to start, there is likely a problem in the starting sequence. You may want to [access the Jupyter logs](../../guides/access-jupyter-logs.md) and try debugging the issue by finding out what is being done during all this starting time.

If the above steps do not lead to the resolution of the problem, please [open a ticket](../index.md#opening-a-ticket). Include logs as much as possible, while being mindful of what data you provide, since tickets can be viewed by anyone on the Internet, and logs often contain sensitive information such as your username, file paths, and other data you might want to remove before posting.