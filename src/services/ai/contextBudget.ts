import type { ChatMessage } from './types'

export const MODEL_CONTEXT_FIXED_OVERHEAD_TOKENS = 24
export const MODEL_CONTEXT_RETRY_RATIO = 0.75

export interface ModelContextBudget {
  contextWindowTokens: number
  outputReserveTokens: number
  inputBudgetTokens: number
}

export interface ModelContextDiagnostics {
  estimatedInputTokens: number
  inputBudgetTokens: number
  includedMessages: number
  omittedMessages: number
  retryLevel: 0 | 1
}

export interface PackedModelContext {
  messages: ChatMessage[]
  maxTokens: number
  diagnostics: ModelContextDiagnostics
}

export class ModelContextBudgetError extends Error {
  constructor() {
    super('模型上下文窗口不足，无法同时保留系统规则和当前问题')
    this.name = 'ModelContextBudgetError'
  }
}

const CRITICAL_HISTORY_PATTERN = /(?:必须|不要|不得|禁止|始终|只允许|授权|确认|尚未|未完成|下一步|继续|约束|要求|remember|must|never|authorization|unfinished|todo)/i
const SELECTION_CONTEXT_PATTERN = /(?:【当前文档上下文】|【本轮可编辑目标】|选中文本|selectionRange)/
const TOOL_RESULT_PATTERN = /(?:工具返回结果|调用工具|复用本轮工具结果|系统已补调)/
const RAG_CONTEXT_PATTERN = /(?:【补充上下文】|【知识库检索结果】|知识来源|检索：)/
const MEMORY_CONTEXT_PATTERN = /(?:【长期记忆】|\[记忆 \d+\])/

export function estimateModelTokens(text: string): number {
  let ascii = 0
  let nonAscii = 0
  for (const char of text) {
    if (char.codePointAt(0)! <= 0x7f) ascii += 1
    else nonAscii += 1
  }
  return Math.ceil(ascii / 4) + nonAscii
}

export function estimateMessageTokens(message: ChatMessage): number {
  return 4 + estimateModelTokens(message.content)
}

export function resolveModelContextBudget(contextWindowTokens: number, retryLevel: 0 | 1 = 0): ModelContextBudget {
  const normalizedWindow = Math.max(128, Math.floor(contextWindowTokens || 8192))
  const outputReserveTokens = Math.min(4096, Math.max(32, Math.floor(normalizedWindow * 0.25)))
  const baseInputBudget = Math.max(32, normalizedWindow - outputReserveTokens - MODEL_CONTEXT_FIXED_OVERHEAD_TOKENS)
  return {
    contextWindowTokens: normalizedWindow,
    outputReserveTokens,
    inputBudgetTokens: retryLevel === 0
      ? baseInputBudget
      : Math.max(32, Math.floor(baseInputBudget * MODEL_CONTEXT_RETRY_RATIO)),
  }
}

function getMessagePriority(message: ChatMessage, index: number, lastIndex: number): number {
  if (message.role === 'system' || index === lastIndex) return 0
  if (CRITICAL_HISTORY_PATTERN.test(message.content)) return 1
  if (SELECTION_CONTEXT_PATTERN.test(message.content)) return 2
  if (TOOL_RESULT_PATTERN.test(message.content)) return 4
  if (MEMORY_CONTEXT_PATTERN.test(message.content)) return 6
  if (RAG_CONTEXT_PATTERN.test(message.content)) return 5
  return 3
}

export function packModelContext(
  messages: ChatMessage[],
  contextWindowTokens: number,
  retryLevel: 0 | 1 = 0,
): PackedModelContext {
  const budget = resolveModelContextBudget(contextWindowTokens, retryLevel)
  if (messages.length === 0) {
    return {
      messages: [],
      maxTokens: budget.outputReserveTokens,
      diagnostics: { estimatedInputTokens: 0, inputBudgetTokens: budget.inputBudgetTokens, includedMessages: 0, omittedMessages: 0, retryLevel },
    }
  }

  const lastIndex = messages.length - 1
  const candidates = messages.map((message, index) => ({
    index,
    message,
    tokens: estimateMessageTokens(message),
    priority: getMessagePriority(message, index, lastIndex),
  }))
  const selected = new Set<number>()
  let used = 0

  const include = (candidate: typeof candidates[number]) => {
    if (selected.has(candidate.index) || used + candidate.tokens > budget.inputBudgetTokens) return false
    selected.add(candidate.index)
    used += candidate.tokens
    return true
  }

  const required = candidates.filter((item) => item.priority === 0)
  if (required.reduce((sum, item) => sum + item.tokens, 0) > budget.inputBudgetTokens) {
    throw new ModelContextBudgetError()
  }
  for (const candidate of required) include(candidate)
  for (let priority = 1; priority <= 6; priority += 1) {
    const group = candidates.filter((item) => item.priority === priority)
    for (let index = group.length - 1; index >= 0; index -= 1) include(group[index])
  }

  const packed = candidates.filter((candidate) => selected.has(candidate.index)).map((candidate) => candidate.message)
  return {
    messages: packed,
    maxTokens: budget.outputReserveTokens,
    diagnostics: {
      estimatedInputTokens: used + MODEL_CONTEXT_FIXED_OVERHEAD_TOKENS,
      inputBudgetTokens: budget.inputBudgetTokens,
      includedMessages: packed.length,
      omittedMessages: messages.length - packed.length,
      retryLevel,
    },
  }
}

export function isModelContextOverflowError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /(?:context length|context window|maximum context|too many tokens|token limit|上下文.*(?:超限|过长)|输入.*过长)/i.test(message)
}
