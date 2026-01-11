import JupyterForObsidian from '@/jupyter-for-obsidian';
import { JupyterEnvironmentError, JupyterEnvironmentType } from '@/services/jupyter-environment';
import { JupyterModal } from '@/services/jupyter-modal';
import { getPythonExecutablePath } from './open-notebooks-feature';

export function displayJupyterErrorModal(
	plugin: JupyterForObsidian,
	error: JupyterEnvironmentError
) {
	switch (error) {
		case JupyterEnvironmentError.UNABLE_TO_SPAWN_JUPYTER:
			displayUnableToSpawnJupyter(plugin);
			break;
		case JupyterEnvironmentError.EXECUTABLE_NOT_FOUND:
			displayExecutableNotFound(plugin);
			break;
		case JupyterEnvironmentError.PERMISSION_DENIED:
			displayPermissionDenied(plugin);
			break;
		case JupyterEnvironmentError.MODULE_NOT_FOUND:
			displayModuleNotFound(plugin);
			break;
		case JupyterEnvironmentError.JUPYTER_EXITED_WITH_ERROR:
			displayJupyterExitedWithError(plugin);
			break;
		case JupyterEnvironmentError.JUPYTER_EXITED_WITHOUT_ERROR:
			displayJupyterExitedWithoutError(plugin);
			break;
		case JupyterEnvironmentError.JUPYTER_STARTING_TIMEOUT:
			displayJupyterStartingTimeout(plugin);
			break;
	}
}

function displayUnableToSpawnJupyter(plugin: JupyterForObsidian) {
	new JupyterModal(
		plugin.app,
		'Spawning Error',
		[
			'Jupyter could not even be started.',
			'Please check your Python executable and make sure Jupyter is installed in the corresponding environment.'
		],
		[
			{
				text: 'Open troubleshooting guide',
				onClick: () => {
					window.open(
						'https://jupyter.mael.im/handbook/troubleshooting/jupyter-errors/spawning-error',
						'_blank'
					);
				},
				closeOnClick: false
			}
		]
	).open();
}

function displayExecutableNotFound(plugin: JupyterForObsidian) {
	new JupyterModal(
		plugin.app,
		'Python Executable Not Found',
		[
			'Could not launch Jupyter because the configured Python executable was not found.',
			'Please check your settings and make sure the path to the Python executable is correct. Note that you might need to provide the full path to the executable depending on your operating system and setup.'
		],
		[
			{
				text: 'Open troubleshooting guide',
				onClick: () => {
					window.open(
						'https://jupyter.mael.im/handbook/troubleshooting/jupyter-errors/python-executable-not-found',
						'_blank'
					);
				},
				closeOnClick: false
			}
		]
	).open();
}

function displayPermissionDenied(plugin: JupyterForObsidian) {
	new JupyterModal(
		plugin.app,
		'Permission denied',
		[
			'Jupyter could not be started due to insufficient permissions.',
			'Please make sure you have the necessary permissions to run the Python executable and Jupyter in the corresponding environment.',
			'On Unix-based systems (Linux, macOS), you might need to mark the Python file as executable using chmod.'
		],
		[
			{
				text: 'Open troubleshooting guide',
				onClick: () => {
					window.open(
						'https://jupyter.mael.im/handbook/troubleshooting/jupyter-errors/permission-denied',
						'_blank'
					);
				},
				closeOnClick: false
			}
		]
	).open();
}

function displayModuleNotFound(plugin: JupyterForObsidian) {
	let pythonExecutable = getPythonExecutablePath(plugin.settings);
	let requiredModule = plugin.settings.jupyterEnvType;
	let moduleName = '';
	let moduleCommand = '';
	switch (requiredModule) {
		case JupyterEnvironmentType.LAB:
			moduleName = 'Jupyter Lab';
			moduleCommand = pythonExecutable + ' -m pip install jupyterlab';
			break;
		case JupyterEnvironmentType.NOTEBOOK:
			moduleName = 'Jupyter Notebook';
			moduleCommand = pythonExecutable + ' -m pip install notebook';
			break;
	}

	let moduleMessage = [];
	if (moduleName === '' || moduleCommand === '') {
		moduleMessage = [
			'Please install Jupyter in the Python environment you configured in the settings.'
		];
	} else {
		moduleMessage = [
			'Your settings indicate that you want to use ' +
				moduleName +
				' as the Jupyter environment.',
			'Please install it by running the following command:',
			{ markdown: '```bash\n' + moduleCommand + '\n```' }
		];
	}

	new JupyterModal(
		plugin.app,
		'Module not found',
		[
			'Python could not start Jupyter, most probably because the required module is not installed.',
			...moduleMessage
		],
		[
			{
				text: 'Open troubleshooting guide',
				onClick: () => {
					window.open(
						'https://jupyter.mael.im/handbook/troubleshooting/jupyter-errors/module-not-found',
						'_blank'
					);
				},
				closeOnClick: false
			}
		]
	).open();
}

function displayJupyterExitedWithError(plugin: JupyterForObsidian) {
	let lastLog = plugin.env.getLastLog();
	let lastLogMessage = [];
	if (lastLog === '') {
		lastLogMessage = ['Jupyter did not log any message before crashing.'];
	} else {
		lastLogMessage = [
			'The last log message from Jupyter was:',
			{ markdown: '```\n' + lastLog + '\n```' }
		];
	}
	new JupyterModal(
		plugin.app,
		'Jupyter crashed',
		['Jupyter encountered an error and stopped unexpectedly.', ...lastLogMessage],
		[
			{
				text: 'Open troubleshooting guide',
				onClick: () => {
					window.open(
						'https://jupyter.mael.im/handbook/troubleshooting/jupyter-errors/jupyter-crashed',
						'_blank'
					);
				},
				closeOnClick: false
			}
		]
	).open();
}

function displayJupyterExitedWithoutError(plugin: JupyterForObsidian) {
	let lastLog = plugin.env.getLastLog();
	let lastLogMessage = [];
	if (lastLog === '') {
		lastLogMessage = ['Jupyter did not log any message before exiting.'];
	} else {
		lastLogMessage = [
			'The last log message from Jupyter was:',
			{ markdown: '```\n' + lastLog + '\n```' }
		];
	}

	new JupyterModal(
		plugin.app,
		'Jupyter exited',
		[
			'Jupyter crashed while starting but did not encounter an error.',
			"This is a very rare case and might be due to an 'exit()' statement that got lost in your Jupyter configuration.",
			...lastLogMessage
		],
		[
			{
				text: 'Open troubleshooting guide',
				onClick: () => {
					window.open(
						'https://jupyter.mael.im/handbook/troubleshooting/jupyter-errors/jupyter-exited',
						'_blank'
					);
				},
				closeOnClick: false
			}
		]
	).open();
}

function displayJupyterStartingTimeout(plugin: JupyterForObsidian) {
	// Adapt the error message to the timeout value from the settings
	// If the timeout is too low, the user might want to try increasing it
	let timeoutSeconds = plugin.settings.jupyterTimeoutMs / 1000;

	// A timeout of 0 or less means no timeout, thus this error is not expected
	// to occur in that scenario
	if (timeoutSeconds <= 0) {
		new JupyterModal(
			plugin.app,
			'Jupyter Timeout',
			[
				'The Jupyter server took too long to start.',
				'This should not normally happen since the timeout is disabled in your settings.',
				'Try restarting Jupyter. If the problem persists, please open a ticket.'
			],
			[
				{
					text: 'Open a ticket',
					onClick: () => {
						window.open(
							'https://jupyter.mael.im/handbook/troubleshooting/#opening-a-ticket',
							'_blank'
						);
					},
					closeOnClick: false
				}
			]
		).open();
		return;
	}

	let tipMessage = '';
	if (timeoutSeconds < 15) {
		tipMessage =
			'This is a very short timeout and might not be enough for the server to start. Please try increasing it and see if the error disappears.';
	} else if (timeoutSeconds < 45) {
		tipMessage =
			'This timeout seems reasonable, but depending on your system and configuration, it might still be too short. Try starting Jupyter again and increasing the timeout if the problem persists.';
	} else {
		tipMessage =
			'This is already a significant timeout. The problem might be in the Jupyter starting sequence itself. You can make sure by setting your timeout to 0 (which disables the timeout) and see if Jupyter is able to start eventually.';
	}

	new JupyterModal(
		plugin.app,
		'Jupyter Timeout',
		[
			'The Jupyter server took too long to start.',
			'You can set the timeout in the settings of the Jupyter plugin. Your current timeout is set to ' +
				timeoutSeconds +
				' second(s).',
			tipMessage
		],
		[
			{
				text: 'Open troubleshooting guide',
				onClick: () => {
					window.open(
						'https://jupyter.mael.im/handbook/troubleshooting/jupyter-errors/jupyter-timeout',
						'_blank'
					);
				},
				closeOnClick: false
			}
		]
	).open();
}
