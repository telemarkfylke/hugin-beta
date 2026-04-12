import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vitest/config"

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Allow callbacks from Docker containers via host.docker.internal
		allowedHosts: ["host.docker.internal"]
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: "./vite.config.ts",
				mode: "tests",
				test: {
					name: "client",
					include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
					exclude: ["src/lib/server/**", "tests/server/**"]
				}
			},
			{
				extends: "./vite.config.ts",
				mode: "tests",
				test: {
					name: "server",
					environment: "node",
					include: ["tests/server/**/*.{test,spec}.{js,ts}"]
				}
			}
		]
	}
})
