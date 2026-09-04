import type { Handle } from "@sveltejs/kit"
import { env } from "$env/dynamic/private"

const PLACEHOLDER = "%plausible%"

const escapeAttribute = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/**
 * Plausible's install snippet, verbatim apart from the src.
 *
 * It is injected here rather than written straight into app.html so it can be left out
 * entirely outside prod: test/beta and prod run the same build from the same repo, so a
 * hardcoded snippet would file betatester traffic under the prod site's numbers.
 *
 * Sitting in app.html (rather than <svelte:head>) means it is plain parser-inserted HTML on
 * every response, so it also covers `/` and `/agents/[agentId]`, which set `ssr = false`.
 */
const plausibleSnippet = (scriptUrl: string): string =>
	`<script async src="${escapeAttribute(scriptUrl)}"></script>
		<script>
			window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
			plausible.init()
		</script>`

export const handle: Handle = async ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) => {
			if (!html.includes(PLACEHOLDER)) return html
			const scriptUrl = env.PLAUSIBLE_SCRIPT_URL
			return html.replace(PLACEHOLDER, scriptUrl ? plausibleSnippet(scriptUrl) : "")
		}
	})
