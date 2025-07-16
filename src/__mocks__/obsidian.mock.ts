/**
 * THIS FILE IS ONLY USED FOR TEST PURPOSES
 *
 * Mocks the Obsidian-provided functions used in the code for unit
 * tests with Vitest.
 */

/**
 * A standard debounce function.
 * Use this to have a time-delayed function only be called once in a given timeframe.
 *
 * @param cb - The function to call.
 * @param timeout - The timeout to wait, in milliseconds
 * @param resetTimer - Whether to reset the timeout when the debouncer is called again.
 * @returns a debounced function that takes the same parameter as the original function.
 * @example
 * ```ts
 * const debounced = debounce((text: string) => {
 *     console.log(text);
 * }, 1000, true);
 * debounced("Hello world"); // this will not be printed
 * await sleep(500);
 * debounced("World, hello"); // this will be printed to the console.
 * ```
 * @public
 */
export function debounce<T extends unknown[], V>(
	cb: (...args: [...T]) => V,
	timeout?: number,
	resetTimer?: boolean
): Debouncer<T, V> {
	let timer: NodeJS.Timeout | null = null;
	let lastResult: V | void;

	const debounced = (...args: [...T]): Debouncer<T, V> => {
		if (timer !== null && resetTimer) {
			clearTimeout(timer);
		}

		timer = setTimeout(() => {
			lastResult = cb(...args);
			timer = null;
		}, timeout ?? 0);

		return debounced;
	};

	debounced.cancel = () => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
		return debounced;
	};

	debounced.run = () => lastResult;

	return debounced as Debouncer<T, V>;
}

/** @public */
export interface Debouncer<T extends unknown[], V> {
	/** @public */
	(...args: [...T]): this;
	/** @public */
	cancel(): this;
	/** @public */
	run(): V | void;
}

/**
 * A mock implementation of the Obsidian FileSystemAdapter class.
 * This is used to mock the adapter in tests.
 * @public
 */
export class FileSystemAdapter {
	constructor(private basePath: string = '/mock/base/path') {
		// Mock implementation
	}

	getBasePath(): string {
		return this.basePath;
	}
}

export function normalizePath(path: string): string {
	return path;
}
