import { describe, expect, it, vi } from 'vitest'
import {
  decodeReadingArtifact,
  checkReadingArtifactSource,
  decodeAnnotationStructuredContent,
  decodeFlashcardStructuredContent,
  getAnnotationStructuredContent,
  getFlashcardStructuredContent,
  resolveAnnotationPosition,
  computeAnnotationFingerprint,
  parseFlashcardCandidates,
  findMarkdownBlockByOffset,
  findMarkdownBlockByQuote,
  type ReadingArtifactRow,
} from '@/services/database/readingArtifacts'
import { parseMarkdownBlocks } from '@/services/markdownBlocks'

function baseRow(overrides: Partial<ReadingArtifactRow> = {}): ReadingArtifactRow {
  return {
    id: 'artifact-1',
    type: 'summary',
    title: '匿名摘要',
    content: '这是匿名摘要正文',
    structured_content: null,
    source_file_path: 'C:/anonymous/note.md',
    source_file_name: 'note.md',
    source_content_hash: 'hash-1',
    source_heading_path: '["章节A"]',
    source_start_line: 2,
    source_end_line: 4,
    source_quote: '引用快照',
    source_message_id: 'message-1',
    source_scope: 'document',
    status: 'active',
    created_at: 1700000000,
    updated_at: 1700000001,
    ...overrides,
  }
}

describe('decodeReadingArtifact', () => {
  it('解码有效行：含来源锚点、结构化字段与时间戳归一', () => {
    const artifact = decodeReadingArtifact(baseRow({
      structured_content: '{"points":["要点A"]}',
      created_at: 1700000000, // 秒级时间戳
    }))
    expect(artifact.id).toBe('artifact-1')
    expect(artifact.type).toBe('summary')
    expect(artifact.title).toBe('匿名摘要')
    expect(artifact.source?.filePath).toBe('C:/anonymous/note.md')
    expect(artifact.source?.headingPath).toEqual(['章节A'])
    expect(artifact.source?.startLine).toBe(2)
    expect(artifact.source?.endLine).toBe(4)
    expect(artifact.source?.quote).toBe('引用快照')
    expect(artifact.source?.contentHash).toBe('hash-1')
    expect(artifact.source?.scope).toBe('document')
    expect(artifact.structuredContent).toEqual({ points: ['要点A'] })
    // 秒级时间戳应归一为毫秒
    expect(artifact.createdAt).toBe(1700000000000)
  })

  it('毫秒级时间戳保持不变', () => {
    const artifact = decodeReadingArtifact(baseRow({ created_at: 1700000000000 }))
    expect(artifact.createdAt).toBe(1700000000000)
  })

  it('无来源字段时 source 为 null', () => {
    const artifact = decodeReadingArtifact(baseRow({
      source_file_path: null,
      source_file_name: null,
      source_quote: null,
      source_message_id: null,
      source_heading_path: null,
      source_start_line: null,
      source_end_line: null,
      source_content_hash: null,
      source_scope: null,
    }))
    expect(artifact.source).toBeNull()
  })

  it('未知类型抛出可见错误，不静默丢弃', () => {
    expect(() => decodeReadingArtifact(baseRow({ type: 'unknown_type' }))).toThrow(/未知.*类型/)
  })

  it('未知状态抛出可见错误', () => {
    expect(() => decodeReadingArtifact(baseRow({ status: 'deleted' }))).toThrow(/状态/)
  })

  it('未知阅读范围抛出可见错误', () => {
    expect(() => decodeReadingArtifact(baseRow({ source_scope: 'galaxy' }))).toThrow(/scope/)
  })

  it('损坏的 structured_content 抛出可见错误', () => {
    expect(() => decodeReadingArtifact(baseRow({ structured_content: '{not-json' }))).toThrow(/structured_content/)
  })

  it('损坏的 heading_path 抛出可见错误', () => {
    expect(() => decodeReadingArtifact(baseRow({ source_heading_path: '{not-json' }))).toThrow(/heading_path/)
  })

  it('heading_path 非字符串数组抛出错误', () => {
    expect(() => decodeReadingArtifact(baseRow({ source_heading_path: '[1,2]' }))).toThrow(/heading_path/)
  })

  it('所有合法类型均可解码', () => {
    for (const type of ['summary', 'question_set', 'annotation', 'flashcard_set', 'note'] as const) {
      const artifact = decodeReadingArtifact(baseRow({ type }))
      expect(artifact.type).toBe(type)
    }
  })
})

describe('checkReadingArtifactSource', () => {
  const anchor = {
    filePath: 'C:/anonymous/note.md',
    fileName: 'note.md',
    contentHash: 'hash-1',
    headingPath: ['章节A'],
    startLine: 2,
    endLine: 4,
    quote: '引用快照',
    messageId: null,
    scope: 'document' as const,
  }

  it('哈希匹配时返回 valid', async () => {
    const provider = vi.fn().mockResolvedValue('hash-1')
    const result = await checkReadingArtifactSource(anchor, provider)
    expect(result.status).toBe('valid')
    expect(result.currentHash).toBe('hash-1')
  })

  it('哈希不匹配时返回 changed，不自动贴到相似段落', async () => {
    const provider = vi.fn().mockResolvedValue('hash-2')
    const result = await checkReadingArtifactSource(anchor, provider)
    expect(result.status).toBe('changed')
    expect(result.currentHash).toBe('hash-2')
  })

  it('文件不可读取时返回 missing', async () => {
    const provider = vi.fn().mockResolvedValue(undefined)
    const result = await checkReadingArtifactSource(anchor, provider)
    expect(result.status).toBe('missing')
  })

  it('filePath 缺失时返回 missing', async () => {
    const provider = vi.fn()
    const result = await checkReadingArtifactSource({ ...anchor, filePath: '' }, provider)
    expect(result.status).toBe('missing')
    expect(provider).not.toHaveBeenCalled()
  })

  it('锚点无 contentHash 时只要有文件即视为 valid', async () => {
    const provider = vi.fn().mockResolvedValue('any-hash')
    const result = await checkReadingArtifactSource({ ...anchor, contentHash: null }, provider)
    expect(result.status).toBe('valid')
  })
})

describe('decodeAnnotationStructuredContent', () => {
  it('解码合法批注结构', () => {
    const decoded = decodeAnnotationStructuredContent({
      quote: '被批注的原文',
      note: '这是批注正文',
      contextFingerprint: 'fp-1',
      startOffset: 10,
      endOffset: 20,
    })
    expect(decoded.quote).toBe('被批注的原文')
    expect(decoded.note).toBe('这是批注正文')
    expect(decoded.contextFingerprint).toBe('fp-1')
    expect(decoded.startOffset).toBe(10)
    expect(decoded.endOffset).toBe(20)
  })

  it('quote 缺失抛出可见错误，不保存残缺批注', () => {
    expect(() => decodeAnnotationStructuredContent({ note: '正文' })).toThrow(/quote/)
  })

  it('note 缺失抛出可见错误', () => {
    expect(() => decodeAnnotationStructuredContent({ quote: '原文' })).toThrow(/note/)
  })

  it('非对象抛出可见错误', () => {
    expect(() => decodeAnnotationStructuredContent('not-object')).toThrow(/对象/)
    expect(() => decodeAnnotationStructuredContent(null)).toThrow(/对象/)
  })

  it('offset 非有限数时归一为 null', () => {
    const decoded = decodeAnnotationStructuredContent({
      quote: '原文',
      note: '正文',
      startOffset: 'bad',
      endOffset: NaN,
    })
    expect(decoded.startOffset).toBeNull()
    expect(decoded.endOffset).toBeNull()
  })

  it('annotation 行经 decodeReadingArtifact 后可由 getAnnotationStructuredContent 取出', () => {
    const artifact = decodeReadingArtifact(baseRow({
      type: 'annotation',
      structured_content: '{"quote":"原文","note":"批注正文","contextFingerprint":"fp"}',
    }))
    const annotation = getAnnotationStructuredContent(artifact)
    expect(annotation?.quote).toBe('原文')
    expect(annotation?.note).toBe('批注正文')
  })

  it('损坏的 annotation structured_content 经 getAnnotationStructuredContent 安全降级为 null', () => {
    const artifact = decodeReadingArtifact(baseRow({
      type: 'annotation',
      structured_content: '{"note":"缺 quote"}',
    }))
    expect(getAnnotationStructuredContent(artifact)).toBeNull()
  })

  it('非批注类型 getAnnotationStructuredContent 返回 null', () => {
    const artifact = decodeReadingArtifact(baseRow({ type: 'summary' }))
    expect(getAnnotationStructuredContent(artifact)).toBeNull()
  })
})

describe('decodeFlashcardStructuredContent', () => {
  it('解码合法卡片集', () => {
    const decoded = decodeFlashcardStructuredContent({
      cards: [
        { front: '正面1', back: '背面1', tags: ['标签'] },
        { front: '正面2', back: '背面2' },
      ],
    })
    expect(decoded.cards).toHaveLength(2)
    expect(decoded.cards[0].front).toBe('正面1')
    expect(decoded.cards[0].tags).toEqual(['标签'])
    expect(decoded.cards[1].tags).toBeUndefined()
  })

  it('空卡片数组抛出可见错误，不保存残缺卡片', () => {
    expect(() => decodeFlashcardStructuredContent({ cards: [] })).toThrow(/非空数组/)
  })

  it('cards 缺失抛出可见错误', () => {
    expect(() => decodeFlashcardStructuredContent({})).toThrow(/非空数组/)
  })

  it('卡片 front 缺失抛出可见错误', () => {
    expect(() => decodeFlashcardStructuredContent({ cards: [{ back: '背面' }] })).toThrow(/front/)
  })

  it('tags 非字符串数组抛出可见错误', () => {
    expect(() => decodeFlashcardStructuredContent({
      cards: [{ front: '正', back: '背', tags: [1] }],
    })).toThrow(/tags/)
  })

  it('flashcard_set 行经 decodeReadingArtifact 后可由 getFlashcardStructuredContent 取出', () => {
    const artifact = decodeReadingArtifact(baseRow({
      type: 'flashcard_set',
      structured_content: '{"cards":[{"front":"Q","back":"A"}]}',
    }))
    const cards = getFlashcardStructuredContent(artifact)
    expect(cards?.cards).toHaveLength(1)
    expect(cards?.cards[0].front).toBe('Q')
  })

  it('损坏的 flashcard structured_content 经 getFlashcardStructuredContent 安全降级为 null', () => {
    const artifact = decodeReadingArtifact(baseRow({
      type: 'flashcard_set',
      structured_content: '{"cards":[]}',
    }))
    expect(getFlashcardStructuredContent(artifact)).toBeNull()
  })
})

describe('Markdown 块定位（虚拟预览安全）', () => {
  const content = '# 标题\n\n第一段正文内容。\n\n## 子标题\n\n第二段内容。\n'

  it('findMarkdownBlockByOffset 按 offset 命中正确顶层块', () => {
    const blocks = parseMarkdownBlocks(content)
    // 标题块起始 offset = 0
    const heading = findMarkdownBlockByOffset(blocks, 0)
    expect(heading?.type).toBe('heading')
    // 第一段正文 offset 在标题之后
    const paraStart = content.indexOf('第一段')
    const paragraph = findMarkdownBlockByOffset(blocks, paraStart)
    expect(paragraph?.type).toBe('paragraph')
    expect(paragraph?.rawSource).toContain('第一段正文内容')
  })

  it('findMarkdownBlockByOffset 超出范围返回 null', () => {
    const blocks = parseMarkdownBlocks(content)
    expect(findMarkdownBlockByOffset(blocks, 9999)).toBeNull()
    expect(findMarkdownBlockByOffset(blocks, -1)).toBeNull()
  })

  it('findMarkdownBlockByQuote 按引用快照命中块', () => {
    const blocks = parseMarkdownBlocks(content)
    const block = findMarkdownBlockByQuote(blocks, '第一段正文内容。')
    expect(block?.type).toBe('paragraph')
    expect(block?.rawSource).toContain('第一段')
  })

  it('findMarkdownBlockByQuote 未命中返回 null', () => {
    const blocks = parseMarkdownBlocks(content)
    expect(findMarkdownBlockByQuote(blocks, '完全不存在的引用文本xyz')).toBeNull()
  })

  it('computeAnnotationFingerprint 对同一块返回稳定指纹', () => {
    const paraStart = content.indexOf('第一段')
    const fp1 = computeAnnotationFingerprint(content, paraStart)
    const fp2 = computeAnnotationFingerprint(content, paraStart + 2)
    expect(fp1).toBeTruthy()
    expect(fp1).toBe(fp2)
  })

  it('computeAnnotationFingerprint 越界返回 null', () => {
    expect(computeAnnotationFingerprint('', 0)).toBeNull()
    expect(computeAnnotationFingerprint(content, 9999)).toBeNull()
  })
})

describe('resolveAnnotationPosition', () => {
  const content = '# 概念\n\n批注目标段落原文。\n\n## 其他\n\n无关内容。\n'

  it('按原始 offset 命中块并返回行号与 renderKey', () => {
    const startOffset = content.indexOf('批注目标段落原文')
    const fingerprint = computeAnnotationFingerprint(content, startOffset)
    const annotation = {
      quote: '批注目标段落原文',
      note: '批注',
      contextFingerprint: fingerprint,
      startOffset,
      endOffset: startOffset + 8,
    }
    const position = resolveAnnotationPosition(content, annotation, null)
    expect(position).not.toBeNull()
    expect(position?.matchedBy).toBe('offset')
    expect(position?.renderKey).toBeTruthy()
    expect(position?.startLine).toBeGreaterThan(0)
  })

  it('块指纹不一致时回退到 quote 重新命中', () => {
    const startOffset = content.indexOf('批注目标段落原文')
    const annotation = {
      quote: '批注目标段落原文',
      note: '批注',
      contextFingerprint: 'stale-fingerprint',
      startOffset,
      endOffset: null,
    }
    const position = resolveAnnotationPosition(content, annotation, null)
    expect(position?.matchedBy).toBe('quote')
  })

  it('offset 与 quote 都失效时回退到锚点行号', () => {
    const annotation = {
      quote: '不存在的引用xyz',
      note: '批注',
      startOffset: 9999,
      endOffset: null,
    }
    const anchor = {
      filePath: 'C:/anonymous/note.md',
      fileName: 'note.md',
      startLine: 3,
      endLine: 3,
    }
    const position = resolveAnnotationPosition(content, annotation, anchor)
    expect(position?.matchedBy).toBe('fallback')
    expect(position?.startLine).toBe(3)
    expect(position?.renderKey).toBe('')
  })

  it('内容为空且无锚点行号时返回 null', () => {
    const annotation = { quote: '原文', note: '批注', startOffset: 5, endOffset: null }
    expect(resolveAnnotationPosition('', annotation, null)).toBeNull()
  })

  it('批注不修改源 Markdown：定位为纯函数，不写回 content', () => {
    const startOffset = content.indexOf('批注目标段落原文')
    const annotation = {
      quote: '批注目标段落原文',
      note: '批注',
      startOffset,
      endOffset: null,
    }
    const before = content
    resolveAnnotationPosition(content, annotation, null)
    expect(content).toBe(before)
  })
})

describe('parseFlashcardCandidates', () => {
  it('解析 ```flashcard JSON 数组围栏块', () => {
    const answer = '一些说明\n```flashcard\n[{"front":"问题1","back":"答案1"},{"front":"问题2","back":"答案2","tags":["t"]}]\n```\n后续'
    const cards = parseFlashcardCandidates(answer)
    expect(cards).not.toBeNull()
    expect(cards).toHaveLength(2)
    expect(cards?.[0].front).toBe('问题1')
    expect(cards?.[1].tags).toEqual(['t'])
  })

  it('解析 ```cards 对象 {cards:[...]} 围栏块', () => {
    const answer = '```cards\n{"cards":[{"front":"Q","back":"A"}]}\n```'
    const cards = parseFlashcardCandidates(answer)
    expect(cards).toHaveLength(1)
    expect(cards?.[0].back).toBe('A')
  })

  it('解析 Q:/A: 问答列表格式', () => {
    const answer = '复习卡片：\nQ: 第一个问题\nA: 第一个答案\nQ: 第二个问题\nA: 第二个答案\n'
    const cards = parseFlashcardCandidates(answer)
    expect(cards).toHaveLength(2)
    expect(cards?.[1].front).toBe('第二个问题')
  })

  it('支持中文 问题:/答案: 前缀', () => {
    const answer = '问题: 中文正面\n答案: 中文背面'
    const cards = parseFlashcardCandidates(answer)
    expect(cards).toHaveLength(1)
    expect(cards?.[0].front).toBe('中文正面')
    expect(cards?.[0].back).toBe('中文背面')
  })

  it('缺少背面的残缺卡片被丢弃，不保存', () => {
    const answer = 'Q: 只有正面没有背面\nQ: 完整问题\nA: 完整答案'
    const cards = parseFlashcardCandidates(answer)
    expect(cards).toHaveLength(1)
    expect(cards?.[0].front).toBe('完整问题')
  })

  it('围栏块内 front/back 为空的卡片被过滤', () => {
    const answer = '```flashcard\n[{"front":"","back":""},{"front":"有效","back":"答案"}]\n```'
    const cards = parseFlashcardCandidates(answer)
    expect(cards).toHaveLength(1)
    expect(cards?.[0].front).toBe('有效')
  })

  it('无法识别的回答返回 null，调用方保留原回答', () => {
    expect(parseFlashcardCandidates('这是一段普通解释，没有卡片')).toBeNull()
    expect(parseFlashcardCandidates('')).toBeNull()
    expect(parseFlashcardCandidates('   ')).toBeNull()
  })

  it('围栏块 JSON 损坏时回退到 Q/A 解析', () => {
    const answer = '```flashcard\n{not valid json\n```\nQ: 备用问题\nA: 备用答案'
    const cards = parseFlashcardCandidates(answer)
    expect(cards).toHaveLength(1)
    expect(cards?.[0].front).toBe('备用问题')
  })

  it('为纯函数，不调用模型、不产生副作用', () => {
    const answer = 'Q: x\nA: y'
    const result1 = parseFlashcardCandidates(answer)
    const result2 = parseFlashcardCandidates(answer)
    expect(result1).toEqual(result2)
  })
})
