import { describe, expect, it } from 'vitest'
import { buildMarkdownHtml } from '@/services/markdownExport'

describe('buildMarkdownHtml', () => {
  it('renders standard Markdown without the React renderer', () => {
    const html = buildMarkdownHtml('# Title\n\n- one\n- two\n\n`inline`', 'Export')

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<code>inline</code>')
    expect(html).not.toContain('react-markdown')
  })

  it('keeps Mermaid code blocks available to the export bootstrapper', () => {
    const html = buildMarkdownHtml('```mermaid\ngraph TD\n  A --> B\n```', 'Diagram')

    expect(html).toContain('<pre class="mermaid">graph TD')
  })
})
