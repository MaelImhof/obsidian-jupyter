import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { Vault } from 'obsidian';
import { getVaultRootPath, inVault, JupyterAbstractPath } from '../../src/services/jupyter-path';
import { FileSystemAdapter } from 'obsidian';

/**
 * Some default test value for the root of an Obsidian vault.
 *
 * Ends with a '/'.
 */
const defaultPath = '/home/obsidian/';

/**
 * Builds a Vault object with a FileSystemAdapter that provides the
 * base path of the vault.
 *
 * @param path The base path that the adapter must provide.
 */
function getVault(path: string = defaultPath): Vault {
	// @ts-ignore
	const adapter = new FileSystemAdapter(defaultPath);
	vi.spyOn(adapter, 'getBasePath').mockReturnValue(path);
	return {
		adapter: adapter
	} as unknown as Vault;
}

describe('getVaultRootPath', () => {
	let mockVault: Vault;

	beforeEach(() => {
		mockVault = getVault();
	});

	it('returns the root path of the vault if on desktop', () => {
		const result = getVaultRootPath(mockVault);
		expect(result).toBe(defaultPath);
		expect(result.endsWith('/')).toBe(true);
	});

	it("adds '/' at the end if not present", () => {
		let path = defaultPath.endsWith('/') ? defaultPath.slice(0, -1) : defaultPath;
		expect(path.endsWith('/')).toBe(false);
		mockVault = getVault(path);
		const result = getVaultRootPath(mockVault);
		expect(result.endsWith('/')).toBe(true);
		expect(result).toBe(path + '/');
	});

	it('throws an error if on mobile', () => {
		mockVault.adapter = null as unknown as FileSystemAdapter;
		expect(() => getVaultRootPath(mockVault)).toThrowError(
			'Invalid environment : Jupyter for Obsidian needs a FileSystemAdapter instance to work with absolute paths.'
		);
	});
});

describe('inVault', () => {
	let mockVault = getVault();
	let fileInside = 'somefile.md';
	let pathInside = defaultPath + fileInside;
	let pathOutside = '/bin/debug/';
	let jupyterPathInside = new JupyterAbstractPath(pathInside, fileInside, false, true);
	let jupyterPathOutside = new JupyterAbstractPath('/bin/debug/', null, true, false);

	it('accepts string path in the vault when root is provided', () => {
		expect(inVault(pathInside, mockVault, defaultPath)).toBe(true);
	});

	it('accepts string path in the vault when root is not provided', () => {
		expect(inVault(pathInside, mockVault, null)).toBe(true);
	});

	it('rejects string path outside the vault when root is provided', () => {
		expect(inVault(pathOutside, mockVault, defaultPath)).toBe(false);
	});

	it('rejects string path outside the vault when root is not provided', () => {
		expect(inVault(pathOutside, mockVault, null)).toBe(false);
	});

	it('accepts Jupyter path in the vault when root is provided', () => {
		expect(inVault(jupyterPathInside, mockVault, defaultPath)).toBe(true);
	});

	it('accepts Jupyter path in the vault when root is not provided', () => {
		expect(inVault(jupyterPathInside, mockVault, null)).toBe(true);
	});

	it('rejects Jupyter path outside the vault when root is provided', () => {
		expect(inVault(jupyterPathOutside, mockVault, defaultPath)).toBe(false);
	});

	it('rejects Jupyter path outside the vault when root is not provided', () => {
		expect(inVault(jupyterPathOutside, mockVault, null)).toBe(false);
	});

	it("accepts root directory without a '/' at the end", () => {
		let rootStripped = defaultPath.slice(0, -1);
		expect(rootStripped.endsWith('/')).toBe(false);
		expect(inVault(rootStripped, mockVault, null)).toBe(true);
	});
});

describe('new JupyterAbstractPath', () => {
	it('normalizes the path', async () => {
		const actual = await vi.importActual<typeof import('obsidian')>('obsidian');

		const spy = vi.spyOn(actual, 'normalizePath');

		const { JupyterAbstractPath } = await import('../../src/services/jupyter-path');

		const filename = 'somefile.md';
		new JupyterAbstractPath(defaultPath + filename, filename, false, true);

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith(defaultPath + filename);
	});

	it("ensures the path ends with '/' if it is a folder", () => {
		const foldername = 'somefolder/';
		const foldernameSliced = foldername.slice(0, -1);
		const jupyterPath = new JupyterAbstractPath(
			defaultPath + foldernameSliced,
			foldernameSliced,
			true,
			true
		);
		expect(jupyterPath.getAbsolutePath()).toBe(defaultPath + foldernameSliced + '/');
		expect(jupyterPath.getRelativePath()).toBe(foldernameSliced + '/');

		const jupyterPath2 = new JupyterAbstractPath(
			defaultPath + foldername,
			foldername,
			true,
			true
		);
		expect(jupyterPath2.getAbsolutePath()).toBe(defaultPath + foldername);
		expect(jupyterPath2.getRelativePath()).toBe(foldername);

		// Try a mix of both as well
		const jupyterPath3 = new JupyterAbstractPath(
			defaultPath + foldernameSliced,
			foldername,
			true,
			true
		);
		expect(jupyterPath3.getAbsolutePath()).toBe(defaultPath + foldernameSliced + '/');
		expect(jupyterPath3.getRelativePath()).toBe(foldername);

		const jupyterPath4 = new JupyterAbstractPath(
			defaultPath + foldername,
			foldernameSliced,
			true,
			true
		);
		expect(jupyterPath4.getAbsolutePath()).toBe(defaultPath + foldername);
		expect(jupyterPath4.getRelativePath()).toBe(foldername);
	});

	it("ensures the path does not end with '/' if it is a file", () => {
		const filename = 'somefile.md';
		const filenameInvalid = filename + '/';
		const jupyterPath = new JupyterAbstractPath(defaultPath + filename, filename, false, true);
		expect(jupyterPath.getAbsolutePath()).toBe(defaultPath + filename);
		expect(jupyterPath.getRelativePath()).toBe(filename);

		const jupyterPath2 = new JupyterAbstractPath(
			defaultPath + filenameInvalid,
			filenameInvalid,
			false,
			true
		);
		expect(jupyterPath2.getAbsolutePath()).toBe(defaultPath + filename);
		expect(jupyterPath2.getRelativePath()).toBe(filename);

		// Try a mix of both as well
		const jupyterPath3 = new JupyterAbstractPath(
			defaultPath + filenameInvalid,
			filename,
			false,
			true
		);
		expect(jupyterPath3.getAbsolutePath()).toBe(defaultPath + filename);
		expect(jupyterPath3.getRelativePath()).toBe(filename);

		const jupyterPath4 = new JupyterAbstractPath(
			defaultPath + filename,
			filenameInvalid,
			false,
			true
		);
		expect(jupyterPath4.getAbsolutePath()).toBe(defaultPath + filename);
		expect(jupyterPath4.getRelativePath()).toBe(filename);
	});

	it('throws an error if the file is in vault but no relative path is provided', () => {
		const filename = 'somefile.md';
		expect(() => {
			new JupyterAbstractPath(defaultPath + filename, null, false, true);
		}).toThrowError(
			'Invalid argument in JupyterAbstractPath constructor : `relative` must not be `null` if `isInVault` is set to `true`'
		);
	});

	it('sets relative path to null if not in vault', () => {
		const otherFolder = '/bin/debug/';
		const filename = 'somefile.md';
		const jupyterPath = new JupyterAbstractPath(otherFolder + filename, filename, false, false);
		expect(jupyterPath.getRelativePath()).toBe(null);
		expect(jupyterPath.getAbsolutePath()).toBe(otherFolder + filename);
		expect(jupyterPath.inVault()).toBe(false);
		expect(jupyterPath.isFolder()).toBe(false);

		const foldername = 'somefolder/';
		const jupyterPath2 = new JupyterAbstractPath(
			otherFolder + foldername,
			foldername,
			true,
			false
		);
		expect(jupyterPath2.getRelativePath()).toBe(null);
		expect(jupyterPath2.getAbsolutePath()).toBe(otherFolder + foldername);
		expect(jupyterPath2.inVault()).toBe(false);
		expect(jupyterPath2.isFolder()).toBe(true);
	});
});

describe('JupyterAbstractPath.append', () => {
	it('throws if the represented entity is not a folder', () => {
		const path = new JupyterAbstractPath(
			'/home/obsidian/somefile.md',
			'/somefile.md',
			false,
			true
		);
		assert.throws(() => path.append('newfile.md', false), Error);
	});

	it("handles relative paths that start with '/' gracefully", () => {
		const path = new JupyterAbstractPath('/home/obsidian/', '/', true, true);
		const appended = path.append('/newfile.md', false);
		expect(appended.getAbsolutePath()).toBe('/home/obsidian/newfile.md');
		expect(appended.getRelativePath()).toBe('/newfile.md');
		expect(appended.isFolder()).toBe(false);
		expect(appended.inVault()).toBe(true);
	});

	it("handles relative paths that do not start with '/' gracefully", () => {
		const path = new JupyterAbstractPath('/home/obsidian/', '/', true, true);
		const appended = path.append('newfile.md', false);
		expect(appended.getAbsolutePath()).toBe('/home/obsidian/newfile.md');
		expect(appended.getRelativePath()).toBe('/newfile.md');
		expect(appended.isFolder()).toBe(false);
		expect(appended.inVault()).toBe(true);
	});

	it('creates a new JupyterAbstractPath object with correct information', () => {
		const rootPath = new JupyterAbstractPath('/home/obsidian/', '/', true, true);
		const otherPath = new JupyterAbstractPath('/bin/debug/', null, true, false);

		const filename = 'somefile.md';
		const foldername = 'somefolder/';

		// Append a file to the root path
		const fileInside = rootPath.append(filename, false);
		expect(fileInside.getAbsolutePath()).toBe('/home/obsidian/' + filename);
		expect(fileInside.getRelativePath()).toBe(rootPath.getRelativePath() + filename);
		expect(fileInside.isFolder()).toBe(false);
		expect(fileInside.inVault()).toBe(true);

		// Append a folder to the root path
		const folderInside = rootPath.append(foldername, true);
		expect(folderInside.getAbsolutePath()).toBe('/home/obsidian/' + foldername);
		expect(folderInside.getRelativePath()).toBe(rootPath.getRelativePath() + foldername);
		expect(folderInside.isFolder()).toBe(true);
		expect(folderInside.inVault()).toBe(true);

		// Append a file to the other path
		const fileOutside = otherPath.append(filename, false);
		expect(fileOutside.getAbsolutePath()).toBe('/bin/debug/' + filename);
		expect(fileOutside.getRelativePath()).toBe(null);
		expect(fileOutside.isFolder()).toBe(false);
		expect(fileOutside.inVault()).toBe(false);

		// Append a folder to the other path
		const folderOutside = otherPath.append(foldername, true);
		expect(folderOutside.getAbsolutePath()).toBe('/bin/debug/' + foldername);
		expect(folderOutside.getRelativePath()).toBe(null);
		expect(folderOutside.isFolder()).toBe(true);
		expect(folderOutside.inVault()).toBe(false);
	});
});
