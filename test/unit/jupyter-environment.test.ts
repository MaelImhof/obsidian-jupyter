import { type Mock, describe, it, expect, vi, beforeEach } from 'vitest';
import { JupyterEnvironment, JupyterEnvironmentType } from '../../src/services/jupyter-environment';
import * as child_process from 'child_process';
import { EventEmitter } from 'stream';

vi.mock('child_process', async () => {
	return {
		spawn: vi.fn()
	};
});

function buildJupyterEnvironment(
	path: string = __dirname,
	printDebug: boolean = true,
	pythonExecutable: string = 'python',
	jupyterTimeoutMs: number = 10000,
	type: JupyterEnvironmentType = JupyterEnvironmentType.LAB,
	customConfigFolderPath: string | null = null,
	useSimpleMode: boolean = false
) {
	return new JupyterEnvironment(
		path,
		printDebug,
		pythonExecutable,
		jupyterTimeoutMs,
		type,
		customConfigFolderPath,
		useSimpleMode
	);
}

function mockSpawn() {
	const mockStdout = new EventEmitter();
	const mockStderr = new EventEmitter();
	const mockProcess = new EventEmitter() as any;
	mockProcess.stdout = mockStdout;
	mockProcess.stderr = mockStderr;

	const spawnMock = child_process.spawn as unknown as Mock;
	spawnMock.mockReturnValue(mockProcess);

	return { spawnMock, mockProcess, mockStdout, mockStderr };
}

describe('JupyterEnvironment', async () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('does not start before the plugin is loaded', async () => {
		const { spawnMock } = mockSpawn();

		const env = buildJupyterEnvironment();

		await env.start();

		expect(spawnMock).not.toHaveBeenCalled();
	});

	it('starts immediately after the plugin is loaded if asked', async () => {
		const { spawnMock } = mockSpawn();

		const env = buildJupyterEnvironment();

		await env.start();

		expect(spawnMock).not.toHaveBeenCalled();

		await env.endLoading();

		expect(spawnMock).toHaveBeenCalledTimes(1);
	});

	it('spawns a Jupyter process', async () => {
		const { spawnMock } = mockSpawn();

		const env = buildJupyterEnvironment();
		env.endLoading();

		await env.start();

		expect(spawnMock).toHaveBeenCalledTimes(1);
	});

	it('can be configured to use JupyterLab type', async () => {
		const { spawnMock } = mockSpawn();

		const env = buildJupyterEnvironment();
		env.setType(JupyterEnvironmentType.LAB);
		env.endLoading();

		await env.start();

		const callArgs = (spawnMock as Mock).mock.calls[0][1];
		expect(Array.isArray(callArgs)).toBe(true);
		expect(callArgs).toContain('jupyterlab');
		expect(callArgs).not.toContain('notebook');
	});

	it('can be configured to use Jupyter Notebook type', async () => {
		const { spawnMock } = mockSpawn();

		const env = buildJupyterEnvironment();
		env.setType(JupyterEnvironmentType.NOTEBOOK);
		env.endLoading();

		await env.start();

		const callArgs = (spawnMock as Mock).mock.calls[0][1];
		expect(Array.isArray(callArgs)).toBe(true);
		expect(callArgs).toContain('notebook');
		expect(callArgs).not.toContain('jupyterlab');
	});

	it('can be configured to use a custom Python executable', async () => {
		const { spawnMock } = mockSpawn();

		const env = buildJupyterEnvironment();
		env.setPythonExecutable('/usr/bin/python3');
		env.endLoading();

		await env.start();

		expect((spawnMock as Mock).mock.calls[0][0]).toBe('/usr/bin/python3');
	});
});
