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
			{ text: "Getting Started", link: "/handbook/" },
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
				text: "User Handbook",
				items: [
					{ text: "Getting Started", link: "/handbook/" },
					{ text: "Features", link: "/handbook/features" },
					{ text: "Settings", link: "/handbook/settings" },
					{
						text: "Guides",
						collapsed: false,
						items: [
							{ text: "Find your Python executable", link: "/handbook/guides/find-python-executable" },
							{ text: "Access Jupyter logs", link: "/handbook/guides/access-jupyter-logs" },
						]
					},
					{
						text: "Troubleshooting",
						collapsed: false,
						items: [
							{ text: 'Introduction', link: "/handbook/troubleshooting/" },
							{ text: "Spawning error", link: "/handbook/troubleshooting/jupyter-errors/spawning-error" },
							{ text: "Python executable not found", link: "/handbook/troubleshooting/jupyter-errors/python-executable-not-found" },
							{ text: "Permission denied", link: "/handbook/troubleshooting/jupyter-errors/permission-denied" },
							{ text: "Module not found", link: "/handbook/troubleshooting/jupyter-errors/module-not-found" },
							{ text: "Jupyter crashed", link: "/handbook/troubleshooting/jupyter-errors/jupyter-crashed" },
							{ text: "Jupyter exited", link: "/handbook/troubleshooting/jupyter-errors/jupyter-exited" },
							{ text: "Jupyter timeout", link: "/handbook/troubleshooting/jupyter-errors/jupyter-timeout" },
						]
					},
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
