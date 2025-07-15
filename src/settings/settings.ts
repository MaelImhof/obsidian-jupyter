import { CreateNotebooksSettings, DEFAULT_CREATE_NOTEBOOKS_SETTINGS } from "@/features/create-notebooks/create-notebooks-settings";
import { DEFAULT_OPEN_NOTEBOOKS_SETTINGS, OpenNotebooksSettings } from "@/features/open-notebooks/open-notebooks-settings";
import { EventEmitter } from "stream";

/**
 * Utility type to flatten an object type.
 */
type Flatten<T> = {
    [K in keyof T]: T[K];
};

/**
 * Regroups all settings from all features into a single type.
 */
export interface Settings extends Flatten<OpenNotebooksSettings & CreateNotebooksSettings> {}

/**
 * Regroups all default setting values from all features into a
 * single object.
 */
export const DEFAULT_SETTINGS: Settings = {
    ...DEFAULT_OPEN_NOTEBOOKS_SETTINGS,
    ...DEFAULT_CREATE_NOTEBOOKS_SETTINGS
}

export type SettingChangeEvent<T> =
    | "change"
    | {
        [K in keyof T & string]: `change:${K}`;
    }[keyof T & string];

export type ListenerForEvent<T, K> =
  K extends `change:${infer P}`
    ? P extends keyof T
      ? (newVal: T[P], oldVal: T[P]) => void
      : never
    : K extends 'change'
      ? (key: keyof T, newVal: T[keyof T], oldVal: T[keyof T]) => void
      : never;

export class SettingsProxy<T extends Record<string, any>> extends EventEmitter {
    private _settings: T;
    public settings: T;

    constructor(initial: T) {
        super();
        this._settings = { ...initial };

        this.settings = new Proxy(this._settings, {
            get: (target, prop: string) => target[prop],
            set: (target, prop: string, value) => {
                const oldValue = target[prop];
                if (oldValue !== value) {
                    // @ts-ignore Works at runtime but TypeScript is being cautious
                    target[prop] = value;
                    this.emit("change", prop, value, oldValue);
                    this.emit(`change:${String(prop)}`, value, oldValue);
                }
                return true;
            }
        });
    }

    override on<K extends SettingChangeEvent<T>>(
        eventName: K,
        listener: ListenerForEvent<T, K>
    ): this {
        return super.on(eventName, listener as any);
    }

    override off<K extends SettingChangeEvent<T>>(
        eventName: K,
        listener: ListenerForEvent<T, K>
    ): this {
        return super.off(eventName, listener as any);
    }

    override once<K extends SettingChangeEvent<T>>(
        eventName: K,
        listener: ListenerForEvent<T, K>
    ): this {
        return super.once(eventName, listener as any);
    }
}