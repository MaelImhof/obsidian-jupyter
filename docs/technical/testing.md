# Automated Tests

> *I find that writing unit tests actually increases my programming speed.*
>
> \- Martin Fowler

I started writing tests for *Jupyter for Obsidian* when I realized I was **scared of making a change in the codebase** because it could break some other feature.

I consider tests as safeguards. If a test breaks, it means I broke something obvious.

On this page, I describe how I test the plugin, and what I test (what features, how they are tested).

## Testing Approaches

Jupyter for Obsidian uses two types of testing :

- **:microscope: Unit testing:** this is when you test a simple, isolated function (a "unit") and simulate/mock the context around it.

- **:rocket: End-to-end testing:** also called system testing, this approach "simulates" a real user launching Obsidian with the plugin installed, clicking on buttons and observing how the plugin reacts.

> [!NOTE]
> Most of the existing end-to-end tests actually run a Jupyter instance on the computer. This means the first test run can take a little bit more time, because Jupyter has to be loaded. Subsequent runs have Jupyter already in some kind of cache, idk how Python works, but basically Jupyter starts faster the following times.

## Tested Features

The features below are tested, sometimes with end-to-end testing (:rocket:), sometimes with unit testing (:microscope:), sometimes with both.

- [X] **:rocket: Creating new notebooks**
    - [X] :rocket: Using a ribbon icon
    - [X] :rocket: Using an Obsidian command
    - [X] :rocket: Using a folder's context menu
    - [X] :rocket: The ribbon icon can be disabled in the settings
    - [X] :rocket: The context menu element can be disabled in the settings
- [X] **:rocket: Open `.ipynb` files directly in Obsidian**
    - [X] :rocket: Clicking on a `.ipynb` file in the files tree opens a new view
- [X] **:rocket: Start Jupyter automatically (or not) when opening a `.ipynb` file**
    - [X] :rocket: If enabled, Jupyter is automatically started when an `.ipynb` file is opened
    - [X] :rocket: If disabled, Jupyter will not be started when an `.ipynb` file is opened
- [X] **:rocket: Manage a Jupyter server directly in Obsidian**
    - [X] :rocket: The ribbon button changes icon depending on the Jupyter server's state
    - [X] :rocket: The user cannot stop the Jupyter server while it is starting by clicking on the ribbon icon
    - [X] :rocket: The ribbon icon can be removed from the ribbon in the settings
    - [X] :rocket: Status update notices can be disabled in the settings
- [ ] **:microscope: Customize Jupyter environment**
    - [ ] :microscope: The Jupyter environment can be started in either Jupyter Lab or Jupyter Notebook mode
    - [ ] :microscope: The Jupyter environment can use a configured Python executable instead of the default `python` command
    - [ ] :microscope: The Jupyter environment can be started in Simple mode automatically (or not) depending on the settings
- [X] **:rocket: Automatically delete checkpoints**
    - [X] :rocket: By default, checkpoints are created for each opened Jupyter file and not deleted
    - [X] :rocket: If enabled, Jupyter checkpoints are all created inside the `.obsidian/jupyter/.ipynb_checkpoints/` directory and deleted when Jupyter is stopped

## Features Not Being Tested

The following features gave me trouble testing, even with unit tests, so I decided they wouldn't be automatically tested.

- **Moving Jupyter checkpoints to system trash**

    This is difficult to check in a test. The test would need knowledge of the OS' trash system functioning, and interact with it directly. Plus the tests would have to work on different OSes, mainly Windows and Linux. I preferred disregarding this feature when it comes to automated testing.

- **Starting/stopping Jupyter from the settings toggle**

    For some reason, I was not able to make end-to-end tests open the plugin's settings. When I made WebDriverIO click on the `Jupyter` tab in the settings modal, nothing happened, and the settings were not opened.

    I figured, it was simpler to change settings through the `data.json` file, but then, I gave up testing other features in settings, such as this one.
