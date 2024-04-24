import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { EventEmitter } from "events";


export function spawnJupyterEnv(path: string): JupyterEnv {
    return new JupyterEnv(
        // TODO : Add a way to pass the path to the python executable
        // TODO : Add a way to use Jupyter Lab instead
        spawn("python", ["-m", "notebook", "--no-browser"], {
            cwd: path
        }),
        path
    );
}

export enum JupyterEnvEvent {
    PORT = "port",
    TOKEN = "token",
    URL = "url"
}

export class JupyterEnv {

    /**
     * The URL to use in a browser to access Jupyter. Often http://localhost:8888.
     */
    private jupyterUrl: string | null = null;
    /**
     * The port to use on localhost to access Jupyter. Often 8888.
     */
    private jupyterPort: number | null = null;
    /**
     * The token to use to access Jupyter.
     */
    private jupyterToken: string | null = null;
    /**
     * Events other parts of the code can listen to.
     * See JupyterEnvEvent for the list of events.
     */
    private events: EventEmitter = new EventEmitter();

    /**
     * @param process The process running the Jupyter environment.
     * @param path The path of the working directory of the Jupyter environment.
     */
    constructor(
        private process: ChildProcessWithoutNullStreams,
        public readonly path: string,
    ) {
        this.process.stderr.on("data", this.processOutput.bind(this));
        this.process.stdout.on("data", this.processOutput.bind(this));
    }

    /**
     * When Jupyter prints out something, parse it to find the URL
     * to access the Jupyter environment.
     * 
     * @param data The data to process.
     */
    private processOutput(data: any) {
        data = data.toString();
        console.debug(data);
        
        const match = data.match(/http:\/\/localhost:(\d+)\/(?:tree)\?token=(\w+)/);
        if (match) {
            this.jupyterPort = parseInt(match[1]);
            this.events.emit(JupyterEnvEvent.PORT, this.jupyterPort.toString());
            this.jupyterToken = match[2];
            this.events.emit(JupyterEnvEvent.TOKEN, this.jupyterToken);
            this.jupyterUrl = `http://localhost:${this.jupyterPort}/?token=${this.jupyterToken}`;
            this.events.emit(JupyterEnvEvent.URL, this.jupyterUrl);
            console.debug(this.jupyterUrl);
        }
    }

    /**
     * Listen to an event of this Jupyter instance.
     * 
     * @param event See JupyterEnvEvent for the list of events.
     * @param callback The function to call when the event occurs.
     */
    public on(event: JupyterEnvEvent, callback: (data: string) => void) {
        switch (event) {
            case JupyterEnvEvent.PORT:
                if (this.jupyterPort !== null) {
                    callback(this.jupyterPort.toString());
                }
                else {
                    this.events.once(event, callback);
                }
                break;
            case JupyterEnvEvent.TOKEN:
                if (this.jupyterToken !== null) {
                    callback(this.jupyterToken);
                }
                else {
                    this.events.once(event, callback);
                }
                break;
            case JupyterEnvEvent.URL:
                if (this.jupyterUrl !== null) {
                    callback(this.jupyterUrl);
                }
                else {
                    this.events.once(event, callback);
                }
                break;
        }
    }

    public getPort(): number | null {
        return this.jupyterPort;
    }

    public getToken(): string | null {
        return this.jupyterToken;
    }

    /**
     * Get the URL to access the Jupyter environment. If null,
     * the Jupyter environment is not ready yet. Use the on method
     * to listen to the URL event.
     */
    public getUrl(): string | null {
        return this.jupyterUrl;
    }

    /**
     * Check if the Jupyter environment is still running.
     */
    public isAlive(): boolean {
        return !this.process.exitCode === null;
    }

    /**
     * Kill the Jupyter environment.
     */
    public kill() {
        this.process.kill();
    }
}