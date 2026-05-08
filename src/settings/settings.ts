import {
	CreateNotebooksSettings,
	DEFAULT_CREATE_NOTEBOOKS_SETTINGS
} from '@/features/create-notebooks/create-notebooks-settings';
import {
	DEFAULT_DELETE_CHECKPOINTS_SETTINGS,
	DeleteCheckpointsSettings
} from '@/features/delete-checkpoints/delete-checkpoints-settings';
import {
	DEFAULT_OPEN_NOTEBOOKS_SETTINGS,
	OpenNotebooksSettings
} from '@/features/open-notebooks/open-notebooks-settings';
import {
	DEFAULT_UPDATE_MODAL_SETTINGS,
	UpdateModalSettings
} from '@/features/update-modal/update-modal-settings';
import { EventEmitter } from 'stream';

/**
 * Utility type to flatten an object type.
 */
type Flatten<T> = {
	[K in keyof T]: T[K];
};

/**
 * Regroups all settings from all features into a single type.
 */
export type Settings = Flatten<
	OpenNotebooksSettings &
		CreateNotebooksSettings &
		UpdateModalSettings &
		DeleteCheckpointsSettings
>;

/**
 * Regroups all default setting values from all features into a
 * single object.
 */
export const DEFAULT_SETTINGS: Settings = {
	...DEFAULT_OPEN_NOTEBOOKS_SETTINGS,
	...DEFAULT_CREATE_NOTEBOOKS_SETTINGS,
	...DEFAULT_UPDATE_MODAL_SETTINGS,
	...DEFAULT_DELETE_CHECKPOINTS_SETTINGS
};

/**
 * Type for TypeScript to infer what events are available
 * for the SettingsProxy class.
 *
 * Automatically infers all `change:<settingName>` events
 * for each setting in the Settings type.
 */
export type SettingChangeEvent<T> =
	| 'change'
	| {
			[K in keyof T & string]: `change:${K}`;
	  }[keyof T & string];

/**
 * Type for TypeScript to know what listener is required for which event.
 *
 * The general "change" event will have a listener that receives three args,
 * the setting key, the new value, and the old value. Other listeners are
 * specific to a certain setting key and will only receive the new and old
 * values.
 */
export type ListenerForEvent<T, K> = K extends `change:${infer P}`
	? P extends keyof T
		? (newVal: T[P], oldVal: T[P]) => void
		: never
	: K extends 'change'
		? (key: keyof T, newVal: T[keyof T], oldVal: T[keyof T]) => void
		: never;

/**
 * A proxy class for making the settings object reactive.
 *
 * Throughout the entire codebase, if some feature of the plugin sets the
 * value of a setting, it will automatically emit related events, without
 * the need to call any additional methods.
 *
 * This proxy also allows others to listen to changes in the settings
 * object, and to react to changes in specific settings.
 */
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
					this.emit('change', prop, value, oldValue);
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
		return super.on(eventName, listener);
	}

	override off<K extends SettingChangeEvent<T>>(
		eventName: K,
		listener: ListenerForEvent<T, K>
	): this {
		return super.off(eventName, listener);
	}

	override once<K extends SettingChangeEvent<T>>(
		eventName: K,
		listener: ListenerForEvent<T, K>
	): this {
		return super.once(eventName, listener);
	}
}
