import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    test: {
        globals: true,
        mockReset: true,
    },
    resolve: {
        alias: {
            'obsidian': resolve(__dirname, './src/__mocks__/obsidian.mock.ts'),
        }
    }
});