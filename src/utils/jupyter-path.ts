import { FileSystemAdapter, normalizePath, Vault } from "obsidian";

/**
 * Retrieves the root absolute (system) path of the provided vault.
 * 
 * @param vault The vault to get the root path of.
 * 
 * @throws If the provided vault does not have a FileSystemAdapter instance attached to it.
 */
export function getVaultRootPath(vault: Vault): string {
    if (vault.adapter instanceof FileSystemAdapter) {
        return vault.adapter.getBasePath();
    }
    else {
        throw new Error("Invalid environment : Jupyter for Obsidian needs a FileSystemAdapter instance to work with absolute paths.");
    }
}

/**
 * Checks whether the provided path lies within the provided Obsidian vault.
 * 
 * @param path The path of the file or folder that is or is not in the vault.
 * @param vault The reference vault to look into.
 * 
 * @returns True if the provided path lies within the provided vault, false otherwise.
 * 
 * @throws If the provided vault does not have a FileSystemAdapter instance attached to it.
 */
export function inVault(path: string|JupyterAbstractPath, vault: Vault, root: string|null = null): boolean {
    if (path instanceof JupyterAbstractPath) {
        path = path.getAbsolutePath();
    }

    if (root === null) {
        return path.startsWith(getVaultRootPath(vault));
    }
    else {
        return path.startsWith(root);
    }
}

/**
 * Represents a file or a folder in the eyes of the Jupyter for Obsidian plugin.
 * 
 * The plugin has to deal with files both inside and outside of the vault, hence it
 * is simpler to use its own type that the one of Obsidian.
 * 
 * The class gives a few additional guarantees about the values it contains and
 * performs some checks at initialization. Can result in an error if the provided
 * properties are invalid or incoherent.
 */
export class JupyterAbstractPath {
    /**
     * The absolute path of the file/folder, for example "C:/some/path/".
     * 
     * This path is guaranteed to be normalized in the sense of Obsidian's normalizePath method.
     * 
     * If the instance is a folder, the absolute path is guaranteed to end with "/".
     */
    private absolutePath: string;

    /**
     * The path of the file/folder relative to the current Obsidian vault,
     * for example "Digital Garden/Home.md".
     * 
     * This path is guaranteed to be normalized in the sense of Obsidian's normalizePath method.
     * 
     * If the instance is a folder, the relative path is guaranteed to end with "/".
     * 
     * If the file or folder is not within the current Obsidian vault, this value is guaranteed to be null.
     */
    private relativePath: string|null;

    /**
     * Whether the instance is a folder or not.
     */
    private isDirectory: boolean;

    /**
     * Whether the instance represents a file or folder inside the current Obsidian vault or not.
     */
    private isInVault: boolean;

    /**
     * Represent a file or a folder in the file system, with information relevant to the Jupyter for Obsidian plugin.
     * 
     * @param absolute The absolute path to the represented file or folder.
     * @param relative The relative path to the represented file or folder if within the vault, null otherwise.
     * @param isFolder Whether the represented entity is a folder.
     * @param isInVault Whether the represented entity (file or folder) lies within the current Obsidian vault.
     * 
     * @throws If `isInVault` is set to `true` but no relative path is provided (`relative` is set to `null`), an error is thrown.
     */
    constructor(absolute: string, relative: string|null, isFolder: boolean, isInVault: boolean) {
        // Set the absolute path attribute
        absolute = normalizePath(absolute);
        if (isFolder && !absolute.endsWith("/")) {
            absolute += "/";
        }
        else if (!isFolder && absolute.endsWith("/")) {
            absolute = absolute.substring(0, absolute.length - 1);
        }
        this.absolutePath = absolute;

        // Set the relative path attribute
        if (!isInVault) {
            this.relativePath = null;
        }
        else if (relative === null) {
            throw new Error("Invalid argument in JupyterAbstractPath constructor : `relative` must not be `null` if `isInVault` is set to `true`");
        }
        else {
            if (isFolder && !relative.endsWith('/')) {
                relative += '/';
            }
            else if (!isFolder && relative.endsWith('/')) {
                relative = relative.substring(0, absolute.length - 1);
            }
            this.relativePath = relative;
        }

        // Set the remaining attributes
        this.isDirectory = isFolder;
        this.isInVault = isInVault;
    }

    /**
     * The absolute path of the file/folder, for example "C:/some/path/".
     * 
     * This path is guaranteed to be normalized in the sense of Obsidian's normalizePath method.
     * 
     * If the instance is a folder, the absolute path is guaranteed to end with "/".
     */
    public getAbsolutePath(): string {
        return this.absolutePath;
    }

    /**
     * The path of the file/folder relative to the current Obsidian vault, for example "Digital Garden/Home.md".
     * 
     * This path is guaranteed to be normalized in the sense of Obsidian's normalizePath method.
     * 
     * If the instance is a folder, the relative path is guaranteed to end with "/".
     * 
     * If the file or folder is not within the current Obsidian vault, this value is guaranteed to be null.
     */
    public getRelativePath(): string|null {
        if (!this.isInVault) {
            return null;
        }

        return this.relativePath;
    }

    /**
     * Whether the instance is a folder or not.
     */
    public isFolder(): boolean {
        return this.isDirectory;
    }

    /**
     * Whether the instance represents a file or folder inside the current Obsidian vault or not.
     */
    public inVault(): boolean {
        return this.isInVault;
    }

    /**
     * Returns a new path instance with the provided relative path appended to the original
     * path contained by the current instance. Does not modify the current instance.
     * 
     * @param relativePath The path to add to the end of the current instance's path.
     * @param isFolder     Whether the represented path of the new instance will be a folder
     *                     (or not, in which case it is a file).
     * 
     * @throws If the current instance is not a folder.
     */
    public append(relativePath: string, isFolder: boolean): JupyterAbstractPath {
        // Cannot add some path to the end of a file's path, must be a folder
        if (!this.isFolder()) {
            throw new Error("Cannot append a path to a file, the instance must represent a folder.");
        }

        // Check that the provided relative path does not start with '/'
        if (relativePath.startsWith('/')) {
            relativePath = relativePath.substring(1);
        }

        return new JupyterAbstractPath(
            this.absolutePath + relativePath,
            this.relativePath === null ? null : this.relativePath + relativePath,
            isFolder,
            this.inVault()
        );
    }

    /**
     * Utility function to ease the creation of a Jupyter abstract path.
     * 
     * Simply give the absolute path of the file/folder and indicate which of the two it is.
     * 
     * @param absolute The absolute path to the file/folder to represent.
     * @param isFolder Whether it is a folder (or not, in which case it is a file).
     * 
     * @throws If the provided vault does not have a FileSystemAdapter instance attached to it.
     */
    public static fromAbsolute(absolute: string, isFolder: boolean, vault: Vault): JupyterAbstractPath {
        // Get the root path of the vault
        const vaultRoot = getVaultRootPath(vault);
        
        // See if the file/folder is in the vault
        const isInVault = inVault(absolute, vault, vaultRoot);

        // Compute the relative path if needed
        const relative = isInVault
            ? absolute.substring(vaultRoot.length)
            : null;

        return new JupyterAbstractPath(absolute, relative, isFolder, isInVault);
    }

    /**
     * Utility function to ease the creation of a Jupyter abstract path.
     * 
     * Simply give the relative path of the file/folder and indicate which of the two it is.
     * 
     * @param relative The path to the file/folder relative to the vault's root.
     * @param isFolder Whether it is a folder (or not, in which case it is a file).
     * 
     * @throws If the provided vault does not have a FileSystemAdapter instance attached to it.
     */
    public static fromRelative(relative: string, isFolder: boolean, vault: Vault): JupyterAbstractPath {
        // Get the root path of the vault
        let vaultRoot = getVaultRootPath(vault);

        // Ensure the vault's root ends with '/'
        if (!vaultRoot.endsWith('/')) {
            vaultRoot = vaultRoot + '/';
        }

        // Ensure that relative does not start with '/'
        if (relative.startsWith('/')) {
            relative = relative.substring(1);
        }

        // Append the relative path to the absolute one of the vault to get the complete path
        return new JupyterAbstractPath(vaultRoot + relative, relative, isFolder, true);
    }
}