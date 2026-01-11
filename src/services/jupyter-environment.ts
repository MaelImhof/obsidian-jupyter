import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import Emittery, { UnsubscribeFunction } from 'emittery';
import { Debouncer, debounce } from 'obsidian';
import { delimiter as path_delimiter } from 'path';

export enum PythonExecutableType {
	PYTHON = 'python',
	PYTHON3 = 'python3',
	PATH = 'path'
}

export enum JupyterEnvironmentType {
	NOTEBOOK = 'notebook',
	LAB = 'lab'
}

export enum JupyterEnvironmentEvent {
	/**
	 * Fired right before the Jupyter environment starts. This is useful for performing
	 * any setup, such as creating a custom Jupyter configuration.
	 */
	ABOUT_TO_START = 'about-to-start',
	/**
	 * When the Jupyter child process has been started, but the server is not ready yet.
	 */
	STARTING = 'starting',
	/**
	 * When the Jupyter environment has started and we know its port number and token.
	 */
	READY = 'ready',
	/**
	 * When the Jupyter environment has been exited.
	 */
	EXIT = 'exit',
	/**
	 * When either of READY, STARTING or EXIT happens.
	 */
	CHANGE = 'change',
	/**
	 * When an error occurs. Often called on top of EXIT because the server exits
	 * when an error is thrown, however EXIT does not provide the reason of the server stopping.
	 */
	ERROR = 'error'
}

export enum JupyterEnvironmentStatus {
	STARTING = 'starting',
	RUNNING = 'running',
	EXITED = 'exited'
}

/**
 * Enumeration of possible errors that can occur and result in Jupyter not starting
 * or crashing unexpectedly.
 */
export enum JupyterEnvironmentError {
	/**
	 * The Jupyter process could not be started for an unknown reason.
	 *
	 * Used when Node's `child_process.spawn` function throws an error, which is not supposed
	 * to happen but is still accounted for as a defensive programming measure.
	 */
	UNABLE_TO_SPAWN_JUPYTER = 'Jupyter process could not be spawned.',

	/**
	 * The Python executable provided by the user (`python`, `python3`, or a custom path) was not found.
	 *
	 * This can happen for example if the user defines `python` as the executable on a Linux system, where
	 * the use of `python3` is required. This can also happen if Python is not installed.
	 *
	 * Note: this error code corresponds to `child_process.spawn`'s `ENOENT` error code. According to Node.js
	 * documentation, this error code can also occur when the provided `cwd` does not exist. However, in our
	 * use-case, this second scenario is very unlikely to happen, because the Jupyter environment's path
	 * is controlled by the plugin and corresponds to the Obsidian vault's root path.
	 */
	EXECUTABLE_NOT_FOUND = 'Python executable not found.',

	/**
	 * Corresponds to `child_process.spawn`'s `EACCES` and `EPERM` error codes.
	 *
	 * This can happen if the user does not have permission to execute the Python executable or to access the
	 * Jupyter module within the selected Python environment. It can also happen if the executable is not
	 * marked as executable (on Unix systems).
	 */
	PERMISSION_DENIED = 'Permission denied when trying to start Jupyter.',

	/**
	 * The selected Python environment works, but the Jupyter module is not installed in it.
	 *
	 * This can happen if the user has not installed Jupyter Notebook or JupyterLab in the selected
	 * Python environment. It can be resolved by installing either Jupyter Lab or Jupyter Notebook,
	 * with the commands `pip install jupyterlab` or `pip install notebook` respectively.
	 */
	MODULE_NOT_FOUND = 'Jupyter module not found in the selected Python environment.',

	/**
	 * The Jupyter process exited with a non-zero exit code, indicating that an error occurred.
	 *
	 * This can occur both in the starting phase (for example if Jupyter fails to start properly), or
	 * after having been started (for example if Jupyter crashes while running).
	 */
	JUPYTER_EXITED_WITH_ERROR = 'Jupyter process crashed.',

	/**
	 * The Jupyter process exited with a zero exit code while it was still starting up,
	 * indicating that it exited without encountering an error, but before being ready to
	 * accept connections.
	 *
	 * This can happen if Jupyter is misconfigured, for example if the configuration
	 * contains an `exit()` instruction.
	 */
	JUPYTER_EXITED_WITHOUT_ERROR = 'Jupyter process exited.',

	/**
	 * The Jupyter process took too long to start, and was assumed to be stuck.
	 *
	 * This can happen if Jupyter is misconfigured, or if the system is under heavy load.
	 * It can be resolved by increasing the Jupyter startup timeout in the plugin settings,
	 * or by fixing the underlying issue causing Jupyter to start slowly.
	 */
	JUPYTER_STARTING_TIMEOUT = 'Jupyter process took too long to start, assumed something was wrong.'
}

/**
 * Type definition of what callback is required for which event.
 *
 * For example, the callback for an ERROR event should take an array
 * containing the Jupyter environment and the error that occurred.
 *
 * But most events simply take the Jupyter environment as an argument.
 *
 * This is primarily to make TypeScript happy and ensure type safety
 * throughout the codebase.
 */
type JupyterEnvironmentEventCallback<
	T extends JupyterEnvironmentEvent,
	R = void
> = T extends JupyterEnvironmentEvent.ERROR
	? (args: [JupyterEnvironment, JupyterEnvironmentError]) => R
	: (env: JupyterEnvironment) => R;

export class JupyterEnvironment {
	private jupyterProcess: ChildProcessWithoutNullStreams | null = null;
	private jupyterLog: string[] = [];
	private jupyterPort: number | null = null;
	private jupyterToken: string | null = null;
	private events: Emittery = new Emittery();
	private status: JupyterEnvironmentStatus = JupyterEnvironmentStatus.EXITED;
	private aboutToStart: boolean = false;
	private runningType: JupyterEnvironmentType | null = null;

	private jupyterTimeoutListener: Debouncer<unknown[], unknown> = debounce(
		this.onJupyterTimeout.bind(this),
		this.jupyterTimeoutMs,
		true
	);
	private jupyterTimedOut: boolean = false;

	/**
	 * Indicates whether this Jupyter environment instance has been fully
	 * loaded. This is set to false once the plugin is done loading.
	 *
	 * This is used for situations where the vault was closed while a Jupyter
	 * view was open, and the vault is reopened. In that case, the Jupyter view
	 * will trigger the Jupyter environment to start, but it might not have
	 * the right settings values at that point in time.
	 *
	 * With this flag, the Jupyter environment will wait until the plugin is done
	 * loading before it starts. If an attempt is made to start the Jupyter
	 * server before the plugin is fully loaded, the starting will be delayed
	 * until the plugin is done loading.
	 */
	private fullyLoaded: boolean = false;

	/**
	 * Indicates whether Jupyter should be started immediately once the
	 * plugin is done loading. See {@link fullyLoaded} for more information.
	 */
	private startJupyterOnLoad: boolean = false;

	constructor(
		private readonly path: string,
		private printDebug: boolean,
		private pythonExecutable: string,
		private jupyterTimeoutMs: number,
		private type: JupyterEnvironmentType,
		private customConfigFolderPath: string | null,
		private useSimpleMode: boolean
	) {}

	/**
	 * Subscribe to one or more events.
	 *
	 * Using the same listener multiple times for the same event will result
	 * in only one method call per emitted event.
	 *
	 * @returns An unsubscribe method.
	 */
	public on<T extends JupyterEnvironmentEvent>(
		event: T,
		callback: JupyterEnvironmentEventCallback<T>
	): UnsubscribeFunction {
		return this.events.on(event, callback);
	}

	/** Remove one or more event subscriptions. */
	public off<T extends JupyterEnvironmentEvent>(
		event: T,
		callback: JupyterEnvironmentEventCallback<T>
	): void {
		this.events.off(event, callback);
	}

	/**
	 * Subscribe to one or more events only once. It will be unsubscribed
	 * after the first event that matches the predicate (if provided).
	 *
	 * @param event The event name to subscribe to.
	 * @param callback The callback function to invoke when the event is
	 *   emitted. Should return a boolean indicating whether the listener
	 *   should be removed (if the returned value is true, the listener is
	 *   removed and won't be called again).
	 */
	public once<T extends JupyterEnvironmentEvent>(
		event: T,
		callback: JupyterEnvironmentEventCallback<T, boolean>
	): void {
		this.events.once(event, callback);
	}

	public isRunning(): boolean {
		return (
			this.jupyterProcess !== null &&
			this.jupyterProcess.exitCode === null &&
			this.status === JupyterEnvironmentStatus.RUNNING
		);
	}

	/**
	 * Indicates to this Jupyter environment instance that the plugin is
	 * done loading. Starting from this point, the Jupyter environment
	 * may be started.
	 *
	 * This is used for situations where the vault was closed while a Jupyter
	 * view was open, and the vault is reopened. In that case, the Jupyter view
	 * will trigger the Jupyter environment to start, but it might not have
	 * the right settings values at that point in time.
	 *
	 * With this flag, the Jupyter environment will wait until the plugin is done
	 * loading before it starts. If an attempt is made to start the Jupyter
	 * server before the plugin is fully loaded, the starting will be delayed
	 * until the plugin is done loading.
	 */
	public async endLoading() {
		this.fullyLoaded = true;

		// If the Jupyter environment was set to start automatically, start it now.
		if (this.startJupyterOnLoad) {
			await this.start();
		}
	}

	public async start() {
		// Wait for the plugin to be fully loaded before starting Jupyter.
		if (!this.fullyLoaded) {
			this.startJupyterOnLoad = true;
			return;
		}

		// Do not start Jupyter if it is already starting or running.
		if (this.aboutToStart || this.getStatus() !== JupyterEnvironmentStatus.EXITED) {
			return;
		}

		this.aboutToStart = true;

		// Emit the ABOUT_TO_START event to allow for any setup before starting Jupyter.
		await this.events.emit(JupyterEnvironmentEvent.ABOUT_TO_START, this);

		// Reset the saved logs.
		this.jupyterLog = [];

		// Prepare the environment variables
		let env = undefined;
		if (this.customConfigFolderPath !== null) {
			env = {
				...process.env,
				JUPYTER_CONFIG_PATH: `${this.customConfigFolderPath}${process.env.JUPYTER_CONFIG_PATH ? path_delimiter + process.env.JUPYTER_CONFIG_PATH : ''}`
			};
		}

		try {
			this.jupyterProcess = spawn(
				this.pythonExecutable,
				[
					'-m',
					this.type === JupyterEnvironmentType.NOTEBOOK ? 'notebook' : 'jupyterlab',
					'--no-browser'
				],
				{
					cwd: this.path,
					env: env
				}
			);
		} catch (e) {
			this.jupyterProcess = null;
			this.aboutToStart = false;
			await this.events.emit(JupyterEnvironmentEvent.ERROR, [
				this,
				JupyterEnvironmentError.UNABLE_TO_SPAWN_JUPYTER
			]);
			return;
		}

		let handled = false;
		this.jupyterProcess.stderr.on('data', this.processJupyterOutput.bind(this));
		this.jupyterProcess.stdout.on('data', this.processJupyterOutput.bind(this));
		this.jupyterProcess.on(
			'error',
			((err: Error & { code?: string }) => {
				// Ensure only either error or close runs, not both
				if (handled) return;
				handled = true;

				this.onSpawnError(err);
			}).bind(this)
		);
		this.jupyterProcess.on(
			'close',
			((_code: number | null, _signal: NodeJS.Signals | null) => {
				// Ensure only either error or close runs, not both
				if (handled) return;
				handled = true;

				this.onJupyterClose(_code, _signal);
			}).bind(this)
		);

		if (this.jupyterTimeoutMs > 0) {
			this.jupyterTimeoutListener();
		}

		this.runningType = this.type;
		this.status = JupyterEnvironmentStatus.STARTING;
		this.aboutToStart = false;
		await this.events.emit(JupyterEnvironmentEvent.STARTING, this);
		await this.events.emit(JupyterEnvironmentEvent.CHANGE, this);
	}

	/**
	 * Toggles the Jupyter environment between running and exited.
	 *
	 * Does nothing if the Jupyter environment is starting.
	 */
	public async toggle() {
		switch (this.status) {
			case JupyterEnvironmentStatus.RUNNING:
				this.exit();
				break;
			case JupyterEnvironmentStatus.EXITED:
				await this.start();
				break;
		}
	}

	/**
	 * Restarts the Jupyter environment.
	 *
	 * Does nothing if the Jupyter environment is starting.
	 */
	public async restart() {
		if (this.status === JupyterEnvironmentStatus.RUNNING) {
			this.exit();
		}

		await this.start();
	}

	private onJupyterTimeout() {
		if (this.status == JupyterEnvironmentStatus.STARTING) {
			this.jupyterTimedOut = true;
			this.exit();
		}
	}

	private async processJupyterOutput(data: string) {
		data = data.toString();
		this.jupyterLog.push(data);
		if (this.printDebug) {
			console.debug(data.toString());
		}

		// If not found yet, parse what Jupyter writes to the console to find
		// the port and the token to authenticate with.
		if (this.status == JupyterEnvironmentStatus.STARTING) {
			const portRegex = new RegExp(`http:\/\/localhost:(\\d+)`);
			const tokenRegex = new RegExp(`token=(\\w+)`);
			const portMatch = data.match(portRegex);
			const tokenMatch = data.match(tokenRegex);
			if (portMatch && tokenMatch) {
				this.jupyterTimeoutListener.cancel();
				this.jupyterPort = parseInt(portMatch[1]);
				this.jupyterToken = tokenMatch[1];
				this.status = JupyterEnvironmentStatus.RUNNING;
				await this.events.emit(JupyterEnvironmentEvent.READY, this);
				await this.events.emit(JupyterEnvironmentEvent.CHANGE, this);
			}
		}
	}

	public setPythonExecutable(value: string) {
		this.pythonExecutable = value;
	}

	public printDebugMessages(value: boolean) {
		this.printDebug = value;
	}

	public setType(value: JupyterEnvironmentType) {
		this.type = value;
	}

	public setJupyterTimeoutMs(value: number) {
		if (value >= 0) {
			this.jupyterTimeoutMs = value;
			if (value > 0) {
				this.jupyterTimeoutListener.cancel();
				this.jupyterTimeoutListener = debounce(
					this.onJupyterTimeout.bind(this),
					this.jupyterTimeoutMs,
					true
				);
			}
		}
	}

	public setCustomConfigFolderPath(value: string | null) {
		this.customConfigFolderPath = value;
	}

	public getCustomConfigFolderPath(): string | null {
		return this.customConfigFolderPath;
	}

	public setUseSimpleMode(value: boolean) {
		this.useSimpleMode = value;
	}

	public getUseSimpleMode(): boolean {
		return this.useSimpleMode;
	}

	public getJupyterTimeoutMs(): number {
		return this.jupyterTimeoutMs;
	}

	public getRunningType(): JupyterEnvironmentType | null {
		return this.runningType;
	}

	public getStatus(): JupyterEnvironmentStatus {
		return this.status;
	}

	public getPort(): number | null {
		return this.jupyterPort;
	}

	public getToken(): string | null {
		return this.jupyterToken;
	}

	public getLog(): string[] {
		return this.jupyterLog;
	}

	public getLastLog(): string {
		if (this.jupyterLog.length === 0) {
			return '';
		}

		return this.jupyterLog[this.jupyterLog.length - 1];
	}

	/**
	 * @param file The path of the file relative to the Jupyter environment's working directory.
	 */
	public getFileUrl(file: string): string | null {
		if (!this.isRunning()) {
			return null;
		}

		return (
			'http://localhost:' +
			this.jupyterPort +
			'/' +
			(this.runningType === JupyterEnvironmentType.NOTEBOOK
				? 'notebooks'
				: this.useSimpleMode
					? 'doc/tree'
					: 'lab/tree') +
			'/' +
			file +
			'?token=' +
			this.jupyterToken
		);
	}

	public exit() {
		if (this.getStatus() !== JupyterEnvironmentStatus.EXITED && this.jupyterProcess !== null) {
			this.jupyterProcess.kill('SIGINT');
		}
	}

	private async onSpawnError(err: Error & { code?: string }) {
		if (this.jupyterProcess === null) {
			return;
		}

		switch (err.code) {
			case 'ENOENT':
				await this.events.emit(JupyterEnvironmentEvent.ERROR, [
					this,
					JupyterEnvironmentError.EXECUTABLE_NOT_FOUND
				]);
				break;
			case 'EACCES':
			case 'EPERM':
				await this.events.emit(JupyterEnvironmentEvent.ERROR, [
					this,
					JupyterEnvironmentError.PERMISSION_DENIED
				]);
				break;
			default:
				await this.events.emit(JupyterEnvironmentEvent.ERROR, [
					this,
					JupyterEnvironmentError.JUPYTER_EXITED_WITH_ERROR
				]);
				break;
		}

		await this.setProcessStateToExited();
	}

	private async onJupyterClose(_code: number | null, _signal: NodeJS.Signals | null) {
		if (this.jupyterProcess === null) {
			return;
		}

		if (this.jupyterProcess.exitCode !== null && this.jupyterProcess.exitCode !== 0) {
			// If an error was encountered, maybe it was because Jupyter is not installed
			// in the selected Python environment.
			const lastLog = this.getLastLog();
			if (
				lastLog.includes(': No module named jupyterlab') ||
				lastLog.includes(': No module named notebook')
			) {
				await this.events.emit(JupyterEnvironmentEvent.ERROR, [
					this,
					JupyterEnvironmentError.MODULE_NOT_FOUND
				]);
			} else {
				await this.events.emit(JupyterEnvironmentEvent.ERROR, [
					this,
					JupyterEnvironmentError.JUPYTER_EXITED_WITH_ERROR
				]);
			}
		} else if (this.jupyterTimedOut) {
			this.jupyterTimedOut = false;
			await this.events.emit(JupyterEnvironmentEvent.ERROR, [
				this,
				JupyterEnvironmentError.JUPYTER_STARTING_TIMEOUT
			]);
		} else if (this.status === JupyterEnvironmentStatus.STARTING) {
			await this.events.emit(JupyterEnvironmentEvent.ERROR, [
				this,
				JupyterEnvironmentError.JUPYTER_EXITED_WITHOUT_ERROR
			]);
		}

		await this.setProcessStateToExited();
	}

	private async setProcessStateToExited() {
		this.jupyterProcess = null;
		this.jupyterPort = null;
		this.jupyterToken = null;
		this.runningType = null;
		this.status = JupyterEnvironmentStatus.EXITED;
		await this.events.emit(JupyterEnvironmentEvent.EXIT, this);
		await this.events.emit(JupyterEnvironmentEvent.CHANGE, this);
	}
}
