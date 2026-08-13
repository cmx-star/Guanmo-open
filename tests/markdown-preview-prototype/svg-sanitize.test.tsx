import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { describe, expect, it } from 'vitest'
import { MARKDOWN_HTML_REHYPE_PLUGINS } from '@/services/markdownHtml'

function renderMarkdown(markdown: string): string {
  return renderToStaticMarkup(
    <ReactMarkdown rehypePlugins={MARKDOWN_HTML_REHYPE_PLUGINS}>{markdown}</ReactMarkdown>,
  )
}

describe('Markdown inline SVG sanitation', () => {
  it('保留静态 SVG 图形和本地 marker 引用', () => {
    const html = renderMarkdown(`
<svg viewBox="0 0 100 40" width="100%" role="img" xmlns="http://www.w3.org/2000/svg">
  <title>匿名流程图</title>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" />
    </marker>
  </defs>
  <rect x="1" y="1" width="20" height="12" rx="6" fill="#E6F1FB" />
  <path d="M21 7H90" marker-end="url(#arrow)" />
  <text x="50" y="30" text-anchor="middle">静态 SVG</text>
</svg>
`)

    expect(html).toContain('<svg viewBox="0 0 100 40"')
    expect(html).toContain('<marker id="user-content-arrow"')
    expect(html).toContain('marker-end="url(#user-content-arrow)"')
    expect(html).toContain('<rect')
    expect(html).toContain('<text')
  })

  it('过滤 SVG 脚本、事件、样式和 foreignObject', () => {
    const html = renderMarkdown(`
<svg viewBox="0 0 10 10" onload="alert(1)">
  <style>body { display: none }</style>
  <script>alert(1)</script>
  <foreignObject><div>不应渲染</div></foreignObject>
  <rect width="10" height="10" fill="url(https://invalid.example/track.svg)" onclick="alert(2)" />
</svg>
`)

    expect(html).toContain('<svg viewBox="0 0 10 10"')
    expect(html).toContain('<rect width="10" height="10"')
    expect(html).not.toContain('<style')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<foreignObject')
    expect(html).not.toContain('onload')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('invalid.example')
    expect(html).not.toContain('不应渲染')
  })
})
