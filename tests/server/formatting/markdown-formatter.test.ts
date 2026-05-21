import { describe, expect, it } from "vitest"
import { markdownFormatter } from "$lib/formatting/markdown-formatter"

describe("markdownFormatter", () => {
	it("escapes raw HTML from model output", () => {
		const html = markdownFormatter('<img src=x onerror="alert(1)">')

		expect(html).toContain("&lt;img")
		expect(html).not.toContain("<img")
		expect(html).toContain("onerror=&quot;alert(1)&quot;")
	})

	it("renders fenced code blocks safely", () => {
		const html = markdownFormatter("```html\n<script>alert(1)</script>\n```")

		expect(html).toContain("&lt;")
		expect(html).toContain("script")
		expect(html).not.toContain("<script>")
	})
})
