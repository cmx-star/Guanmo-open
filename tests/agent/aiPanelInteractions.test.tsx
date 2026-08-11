import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiPanel } from '@/components/ai/AiPanel'

const aiChat = vi.hoisted(() => ({
  messages: [
    { id: 'user-1', role: 'user' as const, content: '匿名问题', timestamp: 1 },
    { id: 'assistant-1', parentId: 'user-1', role: 'assistant' as const, content: '匿名回答', timestamp: 2 },
  ],
  streaming: false,
  error: null,
  timeline: [],
  sendMessage: vi.fn(),
  cancelStream: vi.fn(),
}))

const readingArtifacts = vi.hoisted(() => ({
  artifacts: [{
    id: 'artifact-1',
    type: 'summary' as const,
    title: '匿名摘要',
    content: '匿名成果正文',
    structuredContent: {
      question: '这是一个较长的原问题，用来验证阅读成果展开后默认只显示三行内容，并且用户可以根据需要继续展开查看完整问题。为了确保测试稳定，这段问题会明显超过默认收起阈值。',
      references: [
        {
          kind: 'local' as const,
          filePath: 'C:/anonymous/note.md',
          fileName: 'note.md',
          titlePath: ['章节A'],
          startLine: 2,
          endLine: 4,
        },
        {
          kind: 'web' as const,
          title: '匿名网页',
          url: 'https://example.com/anonymous',
          siteName: 'Example',
          publishedAt: '2026-08-10',
        },
      ],
    },
    source: null,
    status: 'active' as const,
    createdAt: 1,
    updatedAt: 1,
  }],
  loading: false,
  filter: 'all' as const,
  selectedId: null,
  anchorStatuses: {},
  loadArtifacts: vi.fn(),
  setFilter: vi.fn(),
  setSelected: vi.fn(),
  deleteArtifact: vi.fn(),
  saveArtifactFromMessage: vi.fn(),
  checkAnchor: vi.fn(),
  resetAnchorStatus: vi.fn(),
}))

vi.mock('@/hooks/useAiChat', () => ({
  useAiChat: () => aiChat,
}))

vi.mock('@/stores/readingArtifactsStore', () => ({
  useReadingArtifactsStore: (selector: (state: typeof readingArtifacts) => unknown) => selector(readingArtifacts),
}))

describe('AI 面板视图返回', () => {
  const scrollTo = vi.fn()

  beforeEach(() => {
    scrollTo.mockReset()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo
  })

  it('从阅读成果顶部返回聊天时滚动到对话底部', () => {
    render(<AiPanel />)
    const container = document.querySelector<HTMLElement>('.overflow-y-auto')!
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 960 })

    fireEvent.click(screen.getByTitle('阅读成果'))
    scrollTo.mockClear()
    fireEvent.click(screen.getByTitle('返回'))

    expect(scrollTo).toHaveBeenCalledWith({ top: 960 })
  })

  it('展开阅读成果后显示原问题，长问题默认收起并可继续展开', () => {
    render(<AiPanel />)
    fireEvent.click(screen.getByTitle('阅读成果'))

    expect(screen.queryByText('原问题')).not.toBeInTheDocument()
    const header = screen.getByText('匿名摘要').closest('button')!
    expect(header.lastElementChild).toHaveClass('ml-auto')
    expect(header.parentElement).toHaveClass('border-gm-border-subtle', 'bg-gm-surface')
    fireEvent.click(header)

    expect(screen.getByText('原问题')).toBeInTheDocument()
    expect(screen.getByText('成果内容')).toBeInTheDocument()
    expect(screen.getByText('参考来源')).toBeInTheDocument()
    expect(screen.getByText('原问题').parentElement).toHaveClass('bg-gm-primary/5')
    expect(screen.getByText('成果内容').parentElement).toHaveClass('bg-gm-canvas')
    const question = screen.getByText(/这是一个较长的原问题/)
    expect(question.style.webkitLineClamp).toBe('3')
    fireEvent.click(screen.getByRole('button', { name: '展开问题' }))
    expect(question.style.webkitLineClamp).toBe('')
    expect(screen.getByRole('button', { name: '收起问题' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('匿名成果正文')).toHaveClass('text-caption', 'leading-relaxed')
    expect(screen.getByTitle('打开 note.md:2-4')).toHaveTextContent('note.md / 章节A / L2-4')
    expect(screen.getByRole('link', { name: /匿名网页/ })).toHaveAttribute('href', 'https://example.com/anonymous')
  })
})
