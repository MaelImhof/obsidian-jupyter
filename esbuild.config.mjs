import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { promises as fs } from "fs";

const banner =
`/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const test_dir = "test-vault/.obsidian/plugins/jupyter";
const prod = (process.argv[2] === "production");

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ["src/jupyter-obsidian.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: `${test_dir}/main.js`,
});

if (prod) {
	await context.rebuild();
	await fs.copyFile(`${test_dir}/main.js`, "main.js");
	await fs.copyFile(`${test_dir}/manifest.json`, "manifest.json");
	await fs.copyFile(`${test_dir}/styles.css`, "styles.css");
	await fs.copyFile(`${test_dir}/versions.json`, "versions.json");
	process.exit(0);
} else {
	await context.watch();
}