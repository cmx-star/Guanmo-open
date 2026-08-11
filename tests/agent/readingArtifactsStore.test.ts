import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReadingArtifactType } from '@/services/database/readingArtifacts'

const mocks = vi.hoisted(() => ({
  persistReadingArtifact: vi.fn(),
  loadReadingArtifacts: vi.fn(),
  loadDocumentContentHashByPath: vi.fn(),
  savedInput: undefined as Record<string, unknown> | undefined,
}))

vi.mock('@/services/database/readingArtifacts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/database/readingArtifacts')>()
  return {
    ...actual,
    persistReadingArtifact: mocks.persistReadingArtifact,
    loadReadingArtifacts: mocks.loadReadingArtifacts,
  }
})

vi.mock('@/services/database/persistence', () => ({
  loadDocumentContentHashByPath: mocks.loadDocumentContentHashByPath,
}))

import { useReadingArtifactsStore } from '@/stores/readingArtifactsStore'

describe('readingArtifactsStore 保存消息来源', () => {
  beforeEach(() => {
    mocks.savedInput = undefined
    mocks.persistReadingArtifact.mockReset().mockImplementation(async (input: Record<string, unknown>) => {
      mocks.savedInput = input
    })
    mocks.loadDocumentContentHashByPath.mockReset().mockResolvedValue('hash-1')
    mocks.loadReadingArtifacts.mockReset().mockImplementation(async () => {
      if (!mocks.savedInput) return []
      return [{
        id: mocks.savedInput.id,
        type: mocks.savedInput.type,
        title: mocks.savedInput.title,
        content: mocks.savedInput.content,
        structuredContent: mocks.savedInput.structuredContent,
        source: mocks.savedInput.source,
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
      }]
    })
    useReadingArtifactsStore.setState({
      artifacts: [],
      loading: false,
      selectedId: null,
      anchorStatuses: {},
    })
  })

  it.each<ReadingArtifactType>(['summary', 'question_set', 'annotation', 'note'])(
    '%s 保存完整混合来源，并保留第一个本地来源为主锚点',
    async (type) => {
      const structuredContent = type === 'annotation'
        ? { quote: '匿名原文', note: '匿名批注' }
        : null
      const saved = await useReadingArtifactsStore.getState().saveArtifactFromMessage({
        type,
        title: '匿名成果',
        content: '匿名正文',
        question: '匿名问题',
        messageId: 'message-1',
        contextScope: 'workspace',
        structuredContent,
        sources: [
          {
            kind: 'local',
            filePath: 'C:/anonymous/note.md',
            fileName: 'note.md',
            titlePath: ['章节A'],
            startLine: 2,
            endLine: 4,
          },
          {
            kind: 'web',
            title: '匿名网页',
            url: 'https://example.com/anonymous',
            siteName: 'Example',
          },
        ],
      })

      expect(saved).toBeDefined()
      expect(mocks.persistReadingArtifact).toHaveBeenCalledOnce()
      const input = mocks.persistReadingArtifact.mock.calls[0][0]
      expect(input.source).toMatchObject({
        filePath: 'C:/anonymous/note.md',
        fileName: 'note.md',
        contentHash: 'hash-1',
        startLine: 2,
        endLine: 4,
        messageId: 'message-1',
        scope: 'workspace',
      })
      expect(input.structuredContent).toMatchObject({
        question: '匿名问题',
        references: [
          expect.objectContaining({ kind: 'local', fileName: 'note.md', startLine: 2, endLine: 4 }),
          expect.objectContaining({ kind: 'web', title: '匿名网页', url: 'https://example.com/anonymous' }),
        ],
        ...(type === 'annotation' ? { quote: '匿名原文', note: '匿名批注' } : {}),
      })
    },
  )

  it('纯 Web 来源不生成本地锚点，但仍写入 references', async () => {
    await useReadingArtifactsStore.getState().saveArtifactFromMessage({
      type: 'summary',
      title: '匿名摘要',
      content: '匿名正文',
      sources: [{ kind: 'web', title: '匿名网页', url: 'https://example.com/web-only' }],
    })

    const input = mocks.persistReadingArtifact.mock.calls[0][0]
    expect(input.source).toBeNull()
    expect(input.structuredContent).toEqual({
      references: [{ kind: 'web', title: '匿名网页', url: 'https://example.com/web-only' }],
    })
    expect(mocks.loadDocumentContentHashByPath).not.toHaveBeenCalled()
  })
})
