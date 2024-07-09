import { normalizePath } from "obsidian";

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
class JupyterAbstractPath {
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
            absolute.substring(0, absolute.length - 1);
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
}