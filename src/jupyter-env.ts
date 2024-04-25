import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { EventEmitter } from "events";


export function spawnJupyterEnv(path: string): JupyterEnv {
    return new JupyterEnv(
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

    private jupyterUrl: string | null = null;
    private jupyterPort: number | null = null;
    private jupyterToken: string | null = null;
    private events: EventEmitter = new EventEmitter();

    constructor(
        private process: ChildProcessWithoutNullStreams,
        public readonly path: string,
    ) {
        this.process.stderr.on("data", this.processOutput.bind(this));
        this.process.stdout.on("data", this.processOutput.bind(this));
    }

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

    public getUrl(): string | null {
        return this.jupyterUrl;
    }

    public isAlive(): boolean {
        return !this.process.exitCode === null;
    }

    public kill() {
        this.process.kill("SIGINT");
    }
}