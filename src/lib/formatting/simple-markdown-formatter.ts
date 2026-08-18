import markdownit from "markdown-it"

// A second, separate markdown-it instance from $lib/formatting/markdown-formatter.ts (the one
// used for chat/canvas). Not duplication for its own sake: that instance carries KaTeX/syntax-
// highlighting plugins irrelevant here, and flipping its breaks/html options would silently
// change how AI chat responses render. This one is standard CommonMark plus two options - no
// custom syntax, nothing chat/canvas-specific.
//
// breaks: true - a single newline becomes <br>, not just a space, since callers
// author this as plain text rather than hard-wrapped CommonMark.
// html: true - lets callers embed a small inline reference (e.g. a ".spotlight-pill"
// span mimicking a real UI element) directly in a sentence. Safe here since this text
// is always developer-authored, same trust model as the shared chat/canvas formatter.
const md = markdownit({ breaks: true, html: true })

// Callers naturally write multi-line text as a template literal indented to match
// surrounding code. CommonMark reads a line starting with 4+ spaces or a tab as an
// indented code block, so that indentation would otherwise get misread as code.
const stripLeadingWhitespace = (text: string): string => text.replace(/^[ \t]+/gm, "")

export const simpleMarkdownFormatter = (text: string): string => md.render(stripLeadingWhitespace(text))
