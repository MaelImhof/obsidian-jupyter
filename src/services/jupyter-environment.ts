import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import Emittery, { UnsubscribeFunction } from "emittery";
import { Debouncer, debounce } from "obsidian";
import { delimiter as path_delimiter } from "path";

export enum PythonExecutableType {
    PYTHON = "python",
    PATH = "path"
}

export enum JupyterEnvironmentType {
    NOTEBOOK = "notebook",
    LAB = "lab"
}

export enum JupyterEnvironmentEvent {
    /**
     * Fired right before the Jupyter environment starts. This is useful for performing
     * any setup, such as creating a custom Jupyter configuration.
     */
    ABOUT_TO_START = "about-to-start",
    /**
     * When the Jupyter child process has been started, but the server is not ready yet.
     */
    STARTING = "starting",
    /**
     * When the Jupyter environment has started and we know its port number and token.
     */
    READY = "ready",
    /**
     * When the Jupyter environment has been exited.
     */
    EXIT = "exit",
    /**
     * When either of READY, STARTING or EXIT happens.
     */
    CHANGE = "change",
    /**
     * When an error occurs. Often called on top of EXIT because the server exits
     * when an error is thrown, however EXIT does not provide the reason of the server stopping.
     */
    ERROR = "error"
}

export enum JupyterEnvironmentStatus {
    STARTING = "starting",
    RUNNING = "running",
    EXITED = "exited"
}

export enum JupyterEnvironmentError {
    NONE = "No error was encountered.",
    UNABLE_TO_START_JUPYTER = "Jupyter process could not be spawned.",
    JUPYTER_EXITED_WITH_ERROR = "Jupyter process crashed.",
    JUPYTER_EXITED_WITHOUT_ERROR = "Jupyter process exited.",
    JUPYTER_STARTING_TIMEOUT = "Jupyter process took too long to start, assumed something was wrong."
}

/** Type of an event callback depending on the event. */
type JupyterEnvironmentEventCallback<T extends JupyterEnvironmentEvent, R = void> =
    T extends JupyterEnvironmentEvent.ERROR
        ? (args: [JupyterEnvironment, JupyterEnvironmentError]) => R
        : (env: JupyterEnvironment) => R;

export class JupyterEnvironment {
    private jupyterProcess: ChildProcessWithoutNullStreams|null = null;
    private jupyterLog: string[] = [];
    private jupyterPort: number|null = null;
    private jupyterToken: string|null = null;
    private events: Emittery = new Emittery();
    private status: JupyterEnvironmentStatus = JupyterEnvironmentStatus.EXITED;
    private aboutToStart: boolean = false;
    private runningType: JupyterEnvironmentType|null = null;

    private jupyterExitListener: (code: number|null, signal: NodeJS.Signals|null) => void = this.onJupyterExit.bind(this);

    private jupyterTimoutListener: Debouncer<unknown[], unknown> = debounce(this.onJupyterTimeout.bind(this), this.jupyterTimeoutMs, true);
    private jupyerTimedOut: boolean = false;

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
        private customConfigFolderPath: string|null,
        private useSimpleMode: boolean
    ) { }

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
        return this.jupyterProcess !== null && this.jupyterProcess.exitCode === null && this.status === JupyterEnvironmentStatus.RUNNING;
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
            this.start();
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
                JUPYTER_CONFIG_PATH: `${this.customConfigFolderPath}${process.env.JUPYTER_CONFIG_PATH ? path_delimiter + process.env.JUPYTER_CONFIG_PATH : ""}`
            };
        }

        try {
            this.jupyterProcess = spawn(this.pythonExecutable, ["-m", this.type === JupyterEnvironmentType.NOTEBOOK ? "notebook" : "jupyterlab", "--no-browser"], {
                cwd: this.path,
                env: env
            });
        }
        catch (e) {
            this.jupyterProcess = null;
            this.aboutToStart = false;
            await this.events.emit(JupyterEnvironmentEvent.ERROR, [this, JupyterEnvironmentError.UNABLE_TO_START_JUPYTER]);
            return;
        }

        this.jupyterProcess.stderr.on("data", this.processJupyterOutput.bind(this));
        this.jupyterProcess.stdout.on("data", this.processJupyterOutput.bind(this));
        this.jupyterProcess.on("exit", this.jupyterExitListener);
        this.jupyterProcess.on("error", this.jupyterExitListener);

        if (this.jupyterTimeoutMs > 0) {
            this.jupyterTimoutListener();
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
            this.jupyerTimedOut = true;
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
            const regex = new RegExp(`http:\/\/localhost:(\\d+)\/(?:${this.runningType === JupyterEnvironmentType.NOTEBOOK ? "tree" : "lab"})\\?token=(\\w+)`);
            const match = data.match(regex);
            if (match) {
                this.jupyterTimoutListener.cancel();
                this.jupyterPort = parseInt(match[1]);
                this.jupyterToken = match[2];
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
                this.jupyterTimoutListener = debounce(this.onJupyterTimeout.bind(this), this.jupyterTimeoutMs, true);
            }
        }
    }

    public setCustomConfigFolderPath(value: string|null) {
        this.customConfigFolderPath = value;
    }

    public getCustomConfigFolderPath(): string|null {
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

    public getRunningType(): JupyterEnvironmentType|null {
        return this.runningType;
    }

    public getStatus(): JupyterEnvironmentStatus {
        return this.status;
    }

    public getPort(): number|null {
        return this.jupyterPort;
    }

    public getToken(): string|null {
        return this.jupyterToken;
    }

    public getLog(): string[] {
        return this.jupyterLog;
    }

    public getLastLog(): string {
        if (this.jupyterLog.length === 0) {
            return "";
        }

        return this.jupyterLog[this.jupyterLog.length - 1];
    }

    /**
     * @param file The path of the file relative to the Jupyter environment's working directory.
     */
    public getFileUrl(file: string): string|null {
        if (!this.isRunning()) {
            return null;
        }

        return "http://localhost:" + this.jupyterPort + "/"
            + (
                this.runningType === JupyterEnvironmentType.NOTEBOOK
                ? "notebooks"
                : (
                    this.useSimpleMode
                    ? "doc/tree"
                    : "lab/tree"
                )
            ) + "/"
            + file
            + "?token=" + this.jupyterToken;
    }

    public exit() {
        if (this.getStatus() !== JupyterEnvironmentStatus.EXITED && this.jupyterProcess !== null) {
            this.jupyterProcess.kill("SIGINT");
        }
    }

    private async onJupyterExit(_code: number|null, _signal: NodeJS.Signals|null) {
        if (this.jupyterProcess === null) {
            return;
        }

        if (this.jupyterProcess.exitCode !== null && this.jupyterProcess.exitCode !== 0) {
            await this.events.emit(JupyterEnvironmentEvent.ERROR, [this, JupyterEnvironmentError.JUPYTER_EXITED_WITH_ERROR]);
        }
        else if (this.jupyerTimedOut) {
            this.jupyerTimedOut = false;
            await this.events.emit(JupyterEnvironmentEvent.ERROR, [this, JupyterEnvironmentError.JUPYTER_STARTING_TIMEOUT]);
        }
        else if (this.status === JupyterEnvironmentStatus.STARTING) {
            await this.events.emit(JupyterEnvironmentEvent.ERROR, [this, JupyterEnvironmentError.JUPYTER_EXITED_WITHOUT_ERROR]);
        }

        this.jupyterProcess = null;
        this.jupyterPort = null;
        this.jupyterToken = null;
        this.runningType = null;
        this.status = JupyterEnvironmentStatus.EXITED;
        await this.events.emit(JupyterEnvironmentEvent.EXIT, this);
        await this.events.emit(JupyterEnvironmentEvent.CHANGE, this);
    }
}