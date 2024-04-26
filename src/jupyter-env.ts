import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { EventEmitter } from "events";

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
    CHANGE = "change"
}

export enum JupyterEnvironmentStatus {
    STARTING = "starting",
    RUNNING = "running",
    EXITED = "exited"
}

export class JupyterEnvironment {
    private jupyterProcess: ChildProcessWithoutNullStreams|null = null;
    private jupyterPort: number|null = null;
    private jupyterToken: string|null = null;
    private events: EventEmitter = new EventEmitter();
    private status: JupyterEnvironmentStatus = JupyterEnvironmentStatus.EXITED;

    constructor(private readonly path: string, private printDebug: boolean) { }

    public on(event: JupyterEnvironmentEvent, callback: (env: JupyterEnvironment) => void) {
        this.events.on(event, callback);
    }

    public isRunning(): boolean {
        return this.jupyterProcess !== null && this.jupyterProcess.exitCode === null && this.status === JupyterEnvironmentStatus.RUNNING;
    }

    public start() {
        if (this.isRunning()) {
            return;
        }

        this.jupyterProcess = spawn("python", ["-m", "notebook", "--no-browser"], {
            cwd: this.path
        });

        this.jupyterProcess.stderr.on("data", this.processJupyterOutput.bind(this));
        this.jupyterProcess.stdout.on("data", this.processJupyterOutput.bind(this));

        this.status = JupyterEnvironmentStatus.STARTING;
        this.events.emit(JupyterEnvironmentEvent.STARTING, this);
        this.events.emit(JupyterEnvironmentEvent.CHANGE, this);
    }

    private processJupyterOutput(data: string) {
        data = data.toString();
        if (this.printDebug) {
            console.debug(data.toString());
        }

        // If not found yet, parse what Jupyter writes to the console to find
        // the port and the token to authenticate with.
        if (this.status == JupyterEnvironmentStatus.STARTING) {
            const match = data.match(/http:\/\/localhost:(\d+)\/(?:tree)\?token=(\w+)/);
            if (match) {
                this.jupyterPort = parseInt(match[1]);
                this.jupyterToken = match[2];
                this.status = JupyterEnvironmentStatus.RUNNING;
                this.events.emit(JupyterEnvironmentEvent.READY, this);
                this.events.emit(JupyterEnvironmentEvent.CHANGE, this);
            }
        }
    }

    public printDebugMessages(value: boolean) {
        this.printDebug = value;
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

    /**
     * @param file The path of the file relative to the Jupyter environment's working directy.
     */
    public getFileUrl(file: string): string|null {
        if (!this.isRunning()) {
            return null;
        }

        return `http://localhost:${this.jupyterPort}/notebooks/${file}?token=${this.jupyterToken}`;
    }

    public exit() {
        if (this.isRunning()) {
            (this.jupyterProcess as ChildProcessWithoutNullStreams).kill("SIGINT");
            this.jupyterProcess = null;
            this.jupyterPort = null;
            this.jupyterToken = null;
            this.status = JupyterEnvironmentStatus.EXITED;
            this.events.emit(JupyterEnvironmentEvent.EXIT, this);
            this.events.emit(JupyterEnvironmentEvent.CHANGE, this);
        }
    }
}