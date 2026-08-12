import { describe, expect, it, vi } from 'vitest'
import {
  estimateMessageTokens,
  isModelContextOverflowError,
  packModelContext,
  resolveModelContextBudget,
} from '@/services/ai/contextBudget'
import type { ChatMessage } from '@/services/ai/types'
import { streamFinalAnswer } from '@/services/aiChatFlow'

const message = (role: ChatMessage['role'], content: string): ChatMessage => ({ role, content })

describe('unified model context budget', () => {
  it('keeps the hard input bound and output reserve for a small fake window', () => {
    const messages = [
      message('system', '系统规则：只根据证据回答。'),
      ...Array.from({ length: 20 }, (_, index) => message(index % 2 ? 'assistant' : 'user', `旧历史 ${index} ${'x'.repeat(80)}`)),
      message('user', '当前问题：给出结论。'),
    ]
    const packed = packModelContext(messages, 256)
    const budget = resolveModelContextBudget(256)
    const actual = packed.messages.reduce((sum, item) => sum + estimateMessageTokens(item), 0)

    expect(actual).toBeLessThanOrEqual(budget.inputBudgetTokens)
    expect(packed.maxTokens).toBe(budget.outputReserveTokens)
    expect(packed.messages.at(-1)?.content).toContain('当前问题')
    expect(packed.diagnostics.omittedMessages).toBeGreaterThan(0)
  })

  it('retains recent constraints, authorization and unfinished work before ordinary history', () => {
    const messages = [
      message('system', '系统规则'),
      message('user', `普通旧内容 ${'a'.repeat(600)}`),
      message('user', '必须保留这个用户约束。'),
      message('assistant', '尚未完成：等待用户确认授权。'),
      message('user', `普通近期内容 ${'b'.repeat(600)}`),
      message('user', '当前问题'),
    ]
    const packed = packModelContext(messages, 256)
    const contents = packed.messages.map((item) => item.content)

    expect(contents).toContain('必须保留这个用户约束。')
    expect(contents).toContain('尚未完成：等待用户确认授权。')
    expect(contents).not.toContain(messages[1].content)
  })

  it('keeps selection context atomic and drops a lower-priority memory atom', () => {
    const selection = '【当前文档上下文】\n完整选区语义原子'
    const memory = `【长期记忆】\n${'记忆'.repeat(120)}`
    const packed = packModelContext([
      message('system', '系统规则'),
      message('user', selection),
      message('user', memory),
      message('user', '解释选区'),
    ], 256)

    expect(packed.messages.some((item) => item.content === selection)).toBe(true)
    expect(packed.messages.some((item) => item.content === memory)).toBe(false)
  })

  it('recognizes provider context overflow without matching unrelated failures', () => {
    expect(isModelContextOverflowError(new Error('maximum context length exceeded'))).toBe(true)
    expect(isModelContextOverflowError(new Error('network timeout'))).toBe(false)
  })

  it('retries a model overflow once without invoking any external side effect', async () => {
    const chat = vi.fn()
      .mockRejectedValueOnce(new Error('maximum context length exceeded'))
      .mockResolvedValueOnce({ id: 'answer', role: 'assistant', content: '完成' })
    const sideEffect = vi.fn()
    let answer = ''

    await streamFinalAnswer({
      client: {
        chat,
        streamChat: vi.fn(),
        embedding: vi.fn(),
        batchEmbedding: vi.fn(),
        validateConfig: vi.fn(),
        listModels: vi.fn(),
      },
      messages: [message('system', '系统规则'), message('user', '当前问题')],
      streamEnabled: false,
      onUpdate: (content) => { answer = content },
      isCancelled: () => false,
      contextWindowTokens: 256,
    })

    expect(chat).toHaveBeenCalledTimes(2)
    expect(sideEffect).not.toHaveBeenCalled()
    expect(answer).toBe('完成')
  })
})
