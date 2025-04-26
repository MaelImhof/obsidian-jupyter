import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "Jupyter for Obsidian",
	description: "Open Jupyter notebooks directly inside of Obsidian.",
	head: [
		["link", { rel: "icon", type: "image/png", href: "/images/logo.png" }],
	],
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Getting Started", link: "/guide/" },
			{ text: "Contribute", link: "/contribute/" },
		],

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
