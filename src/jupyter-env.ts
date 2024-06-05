import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { EventEmitter } from "events";
import { Debouncer, debounce } from "obsidian";

export enum JupyterEnvironmentType {
    NOTEBOOK = "notebook",
    LAB = "lab"
}

export enum JupyterEnvironmentEvent {
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

export class JupyterEnvironment {
    private jupyterProcess: ChildProcessWithoutNullStreams|null = null;
    private jupyterLog: string[] = [];
    private jupyterPort: number|null = null;
    private jupyterToken: string|null = null;
    private events: EventEmitter = new EventEmitter();
    private status: JupyterEnvironmentStatus = JupyterEnvironmentStatus.EXITED;
    private runningType: JupyterEnvironmentType|null = null;

    private jupyterExitListener: (code: number|null, signal: NodeJS.Signals|null) => void = this.onJupyterExit.bind(this);

    private jupyterTimoutListener: Debouncer<unknown[], unknown> = debounce(this.onJupyterTimeout.bind(this), this.jupyterTimeoutMs, true);
    private jupyerTimedOut: boolean = false;

    constructor(private readonly path: string, private printDebug: boolean, private pythonExecutable: string, private jupyterTimeoutMs: number, private type: JupyterEnvironmentType) { }

    public on(event: JupyterEnvironmentEvent, callback: (env: JupyterEnvironment) => void) {
        this.events.on(event, callback);
    }

    public off(event: JupyterEnvironmentEvent, callback: (env: JupyterEnvironment) => void) {
        this.events.off(event, callback);
    }

    public once(event: JupyterEnvironmentEvent, callback: (env: JupyterEnvironment) => void) {
        this.events.once(event, callback);
    }

    public isRunning(): boolean {
        return this.jupyterProcess !== null && this.jupyterProcess.exitCode === null && this.status === JupyterEnvironmentStatus.RUNNING;
    }

    public start() {
        if (this.getStatus() !== JupyterEnvironmentStatus.EXITED) {
            return;
        }

        // Reset the saved logs.
        this.jupyterLog = [];

        try {
            this.jupyterProcess = spawn(this.pythonExecutable, ["-m", this.type === JupyterEnvironmentType.NOTEBOOK ? "notebook" : "jupyterlab", "--no-browser"], {
                cwd: this.path
            });
        }
        catch (e) {
            this.jupyterProcess = null;
            this.events.emit(JupyterEnvironmentEvent.ERROR, this, JupyterEnvironmentError.UNABLE_TO_START_JUPYTER);
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
        this.events.emit(JupyterEnvironmentEvent.STARTING, this);
        this.events.emit(JupyterEnvironmentEvent.CHANGE, this);
    }

    private onJupyterTimeout() {
        if (this.status == JupyterEnvironmentStatus.STARTING) {
            this.jupyerTimedOut = true;
            this.exit();
        }
    }

    private processJupyterOutput(data: string) {
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
                this.events.emit(JupyterEnvironmentEvent.READY, this);
                this.events.emit(JupyterEnvironmentEvent.CHANGE, this);
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
     * @param file The path of the file relative to the Jupyter environment's working directy.
     */
    public getFileUrl(file: string): string|null {
        if (!this.isRunning()) {
            return null;
        }

        return `http://localhost:${this.jupyterPort}/${this.runningType === JupyterEnvironmentType.NOTEBOOK ? "notebooks" : "lab/tree"}/${file}?token=${this.jupyterToken}`;
    }

    public exit() {
        if (this.getStatus() !== JupyterEnvironmentStatus.EXITED && this.jupyterProcess !== null) {
            this.jupyterProcess.kill("SIGINT");
        }
    }

    private onJupyterExit(_code: number|null, _signal: NodeJS.Signals|null) {
        if (this.jupyterProcess === null) {
            return;
        }

        if (this.jupyterProcess.exitCode !== null && this.jupyterProcess.exitCode !== 0) {
            this.events.emit(JupyterEnvironmentEvent.ERROR, this, JupyterEnvironmentError.JUPYTER_EXITED_WITH_ERROR);
        }
        else if (this.jupyerTimedOut) {
            this.jupyerTimedOut = false;
            this.events.emit(JupyterEnvironmentEvent.ERROR, this, JupyterEnvironmentError.JUPYTER_STARTING_TIMEOUT);
        }
        else if (this.status === JupyterEnvironmentStatus.STARTING) {
            this.events.emit(JupyterEnvironmentEvent.ERROR, this, JupyterEnvironmentError.JUPYTER_EXITED_WITHOUT_ERROR);
        }

        this.jupyterProcess = null;
        this.jupyterPort = null;
        this.jupyterToken = null;
        this.runningType = null;
        this.status = JupyterEnvironmentStatus.EXITED;
        this.events.emit(JupyterEnvironmentEvent.EXIT, this);
        this.events.emit(JupyterEnvironmentEvent.CHANGE, this);
    }
}