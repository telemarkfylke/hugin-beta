/**
 * Hugin embed widget loader
 *
 * One-line embedding for a Hugin agent flagged as "allowAnonymousEmbed" - drops a floating,
 * chrome-less chat bubble onto the page via an <iframe>, positioned/sized by postMessage from
 * the page it loads (see EmbedWidgetChrome.svelte). Ported from bothotell-svelte-web's widget.js -
 * same "setChatbotFrameSize" postMessage protocol, same responsive behavior (desktop: corner
 * widget, mobile: full-screen overlay), just pointed at Hugin's own embed route.
 *
 * Public agents only, for now - embedding an internal/authenticated agent this same way (a
 * floating bubble on an internal page, rather than a plain host-sized iframe) is parked until
 * there's a real need for it.
 *
 * Usage:
 * <script src="https://<hugin-host>/public/widget.js" data-agent-id="<chatConfig._id>"></script>
 */
;(() => {
	// Find the script tag that loaded this file
	const currentScript =
		document.currentScript ||
		(() => {
			const scripts = document.getElementsByTagName("script")
			return scripts[scripts.length - 1]
		})()

	const agentId = currentScript.getAttribute("data-agent-id")
	if (!agentId) {
		console.error("Hugin widget: data-agent-id attribute is required")
		return
	}

	// Origin (protocol + host) for the iframe target - derived from this script's own src, so the
	// same snippet works unchanged across environments (localhost, preview, production). Deliberately
	// the origin only, not a path-sliced "everything before the last /" - this script lives under
	// /public/widget.js, so slicing would fold "/public" into the base and double it up below.
	const baseUrl = new URL(currentScript.src).origin

	const iframe = document.createElement("iframe")
	iframe.id = "hugin-embed-widget-frame"
	iframe.title = "Chat"
	iframe.setAttribute("frameborder", "0")
	iframe.style.cssText = `
		z-index: 2147483647;
		border: 0;
		position: fixed;
		right: 30px;
		bottom: 30px;
	`
	iframe.src = `${baseUrl}/public/embed/agents/${encodeURIComponent(agentId)}`

	const mountIframe = () => document.body.appendChild(iframe)
	if (document.body) {
		mountIframe()
	} else {
		document.addEventListener("DOMContentLoaded", mountIframe)
	}

	// Sizing/positioning is entirely driven by the embedded page - see EmbedWidgetChrome.svelte.
	window.addEventListener("message", (event) => {
		if (!event.data || event.data.type !== "setChatbotFrameSize") return

		const { width, height, position } = event.data
		iframe.style.width = typeof width === "number" ? `${width}px` : width
		iframe.style.height = typeof height === "number" ? `${height}px` : height

		if (position === "fullscreen") {
			// Mobile: full-screen overlay
			iframe.style.position = "fixed"
			iframe.style.top = "0"
			iframe.style.left = "0"
			iframe.style.right = "0"
			iframe.style.bottom = "0"
		} else {
			// Desktop: bottom-right corner widget
			iframe.style.position = "fixed"
			iframe.style.top = "auto"
			iframe.style.left = "auto"
			iframe.style.right = "30px"
			iframe.style.bottom = "30px"
		}
	})
})()
