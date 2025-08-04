import { defineConfig } from "vitepress";
import llmstxt from 'vitepress-plugin-llms';

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "Jupyter for Obsidian",
	description: "Open Jupyter notebooks directly inside of Obsidian.",
	vite: {
		// @ts-ignore because Plugin<any> is not assignable to Plugin<any> for some reason
		plugins: [llmstxt()]
	},
	head: [
		["link", { rel: "icon", type: "image/png", href: "/images/logo.png" }],
	],
	cleanUrls: true,
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Getting Started", link: "/guide/" },
			{ text: "Contribute", link: "/contribute/" },
		],

		editLink: {
			pattern:
				"https://github.com/MaelImhof/obsidian-jupyter/edit/dev/docs/:path",
			text: "Suggest changes to this page",
		},

		search: {
			provider: "local",
		},

		logo: {
			src: "/images/logo.png",
			alt: "",
		},

		outline: {
			level: [2, 3],
		},

		sidebar: [
			{
				text: "User Guide",
				items: [
					{ text: "Getting Started", link: "/guide/" },
					{ text: "Features", link: "/guide/features" },
					{ text: "Settings", link: "/guide/settings" },
					{
						text: "Miniconda and Conda",
						link: "/guide/miniconda-and-conda",
					},
					{ text: "Troubleshooting", link: "/guide/troubleshooting" },
				],
			},
			{
				text: "Contributor Guide",
				items: [{ text: "Contribute", link: "/contribute/" }],
			},
			{
				text: "Technical Reference",
				items: [
					{ text: "Introduction", link: "/technical/" },
					{ text: "Testing", link: "/technical/testing" },
				]
			}
		],

		socialLinks: [
			{
				icon: "discord",
				link: "https://discord.gg/KgkwwRJ3mQ",
			},
			{
				icon: "github",
				link: "https://github.com/MaelImhof/obsidian-jupyter",
			},
		],
	},
});
