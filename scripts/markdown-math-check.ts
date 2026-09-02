import assert from 'node:assert/strict'
import { normalizeLatexBlockDelimiters } from '../src/services/markdownMath'
import { renderMarkdownBody } from '../src/services/markdownExport'

const cases = [
  '$$x^2 + y_1$$',
  '\\[\\text{中文公式} + \\frac{a_1}{b^2}\\]',
  String.raw`\[
\begin{aligned}
a &= b + c \\
d &= e - f
\end{aligned}
\]`,
]

for (const markdown of cases) {
  const html = renderMarkdownBody(markdown)
  assert.match(html, /class="katex"/)
  assert.doesNotMatch(html, /katex-error/)
  assert.match(html, /<annotation encoding="application\/x-tex">/)
}

const anchoredFormula = String.raw`\[
10011
\]`
const anchoredHtml = renderMarkdownBody(anchoredFormula)
assert.match(anchoredHtml, /data-md-line="1"/)
assert.match(anchoredHtml, /data-md-end-line="3"/)
assert.match(anchoredHtml, /<annotation encoding="application\/x-tex">10011<\/annotation>/)

const fenced = ['```text', String.raw`\[`, 'x^2', String.raw`\]`, '```'].join('\n')
assert.equal(normalizeLatexBlockDelimiters(fenced), fenced)
assert.equal(normalizeLatexBlockDelimiters('before \\[x\\] after'), 'before \\[x\\] after')
assert.equal(normalizeLatexBlockDelimiters('  \\[x^2\\]  '), '  $$x^2$$  ')

console.log('Markdown 数学公式检查通过')
process.exit(0)
