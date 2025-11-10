import markdownit from "markdown-it"
import hljs from "highlight.js"
import 'highlight.js/styles/a11y-light.min.css'
import 'katex/dist/katex.min.css'
import { katexPlugin } from "$lib/formatting/katex-plugin"

// Wrap in pre code
const wrapInPreCode = (content) => {
  return `<pre><code class="code-block hljs">${content}</code></pre>`;
}

// Setup markdown-it with highlighting
const md = markdownit({
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return wrapInPreCode(hljs.highlight(str, { language: lang, ignoreIllegals: true }).value)
      } catch (err) {
        console.error("Highlighting error:", err)
      }
    }
    return wrapInPreCode(md.utils.escapeHtml(str));
  }
})

// Add katexPlugin to markdown-it
md.use(katexPlugin)

// Just some bullshit to fix correct formatting for katex - probs badly, but let client handle it
const addKatexToMathStrings = (text) => {
  const lines = text.split('\n')
  let isInCodeBlock = false
  const linesWithKatex = []
  for (let line of lines) {
    if (line.includes('```')) {
      isInCodeBlock = !isInCodeBlock // Toggle code block state
    }
    if (!isInCodeBlock && (line.includes('\\[') || line.includes('\\(') || line.includes('\\]') || line.includes('\\)'))) {
      // Replace math expressions with KaTeX syntax
      line = line.replaceAll('\\[', '$$').replaceAll('\\]', '$$')
      line = line.replaceAll('\\(', '$').replaceAll('\\)', '$')
      linesWithKatex.push(line) // Add the modified line
      continue
    }
    linesWithKatex.push(line) // Add the line as is, if in code block
  }
  return linesWithKatex.join('\n') // Join the lines back into a single string
}

export const markdownFormatter = (text) => {
  const withKatex = addKatexToMathStrings(text)
  return md.render(withKatex)
}