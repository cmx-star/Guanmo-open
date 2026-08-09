import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionProposal } from '@/services/ai/types'
import {
  buildPendingActionResult,
  createActionProposal,
  decodePendingAction,
} from '@/services/agent/actionProposal'
import { decodeAgentStepEvent } from '@/services/agent/session'
import { getTool } from '@/services/agent/toolRegistry'
import { registerBuiltinTools } from '@/services/agent/tools'
import { useChatStore } from '@/stores/chatStore'
import { registerActionExecutor } from '@/services/actionProposalCommand'

const executeActionProposalCommand = vi.fn()

vi.mock('@/services/database/persistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/database/persistence')>()
  return {
    ...actual,
    persistChatSession: vi.fn(),
    persistChatMessage: vi.fn(),
    loadRecentChatTurns: vi.fn().mockResolvedValue([]),
  }
})

function makeProposal(now = Date.now()): ActionProposal {
  const pending = decodePendingAction(JSON.parse(buildPendingActionResult(
    'create_markdown_note',
    { title: '阅读笔记', content: '正文' },
    { title: '新建 Markdown 阅读笔记', target: '由系统保存对话框选择', preview: '阅读笔记\n正文' },
  )))!
  return createActionProposal(pending, { id: 'action-1', messageId: 'assistant-1', now })
}

describe('Agent 行动安全底座', () => {
  beforeEach(() => {
    registerBuiltinTools()
    executeActionProposalCommand.mockReset()
    registerActionExecutor('create_markdown_note', executeActionProposalCommand)
    useChatStore.setState({
      messages: [],
      error: null,
    })
  })

  it('工具注册表声明 effect、capability、确认策略与撤销说明', () => {
    expect(getTool('search_knowledge')).toMatchObject({ effect: 'read', confirmationPolicy: 'never' })
    expect(getTool('replace_current_tab_text')).toMatchObject({ effect: 'write_local', confirmationPolicy: 'required' })
    expect(getTool('propose_create_reading_reminder')).toMatchObject({
      effect: 'schedule',
      capability: 'reading_reminder',
      confirmationPolicy: 'required',
    })
  })

  it('高层工具只返回待确认提案，不直接执行副作用', async () => {
    const raw = await getTool('propose_save_reading_artifact')!.execute({
      artifactType: 'summary',
      title: '匿名摘要',
      content: '摘要正文',
    })
    expect(decodePendingAction(JSON.parse(raw))).toMatchObject({
      kind: 'save_reading_artifact',
      effect: 'write_local',
      payload: { artifactType: 'summary', title: '匿名摘要', content: '摘要正文' },
    })
  })

  it('拒绝未注册动作和文件提案中的任意路径字段', () => {
    expect(() => decodePendingAction({ __pendingAction: true, kind: 'run_shell' })).toThrow(/未注册/)
    expect(() => buildPendingActionResult(
      'create_markdown_note',
      { title: '笔记', content: '正文', path: 'C:/arbitrary.md' },
      { title: '新建笔记', target: '系统对话框', preview: '正文' },
    )).toThrow(/未注册字段 path/)
  })

  it('外部工具事件必须先通过运行时解码', () => {
    const valid = decodeAgentStepEvent({
      type: 'observation',
      toolName: 'propose_create_markdown_note',
      content: buildPendingActionResult(
        'create_markdown_note',
        { title: '笔记', content: '正文' },
        { title: '新建笔记', target: '系统对话框', preview: '正文' },
      ),
      timestamp: 1,
    })
    expect(valid.type === 'observation' && valid.pendingAction?.kind).toBe('create_markdown_note')

    const invalid = decodeAgentStepEvent({
      type: 'observation',
      content: JSON.stringify({ __pendingAction: true, kind: 'run_shell', payload: {} }),
      timestamp: 2,
    })
    expect(invalid.type === 'observation' && invalid.pendingAction).toBeUndefined()
  })

  it('重复确认只执行一次', async () => {
    const proposal = makeProposal()
    useChatStore.setState({
      messages: [{ id: 'assistant-1', role: 'assistant', content: '确认', actionProposal: proposal }],
    })
    executeActionProposalCommand.mockResolvedValue({ status: 'completed' })

    const { confirmActionProposalCommand } = await import('@/services/actionProposalCommand')
    await confirmActionProposalCommand(proposal.id)
    await confirmActionProposalCommand(proposal.id)

    expect(executeActionProposalCommand).toHaveBeenCalledTimes(1)
    expect(useChatStore.getState().messages[0].actionProposal?.status).toBe('completed')
  })

  it('过期提案不会执行', async () => {
    const proposal = { ...makeProposal(1), expiresAt: 2 }
    useChatStore.setState({
      messages: [{ id: 'assistant-1', role: 'assistant', content: '确认', actionProposal: proposal }],
    })

    const { confirmActionProposalCommand } = await import('@/services/actionProposalCommand')
    await confirmActionProposalCommand(proposal.id)

    expect(executeActionProposalCommand).not.toHaveBeenCalled()
    expect(useChatStore.getState().messages[0].actionProposal).toMatchObject({
      status: 'expired',
      errorCategory: 'expired',
    })
  })

  it('目标变化和执行失败记录匿名错误类别，不记录路径或正文', async () => {
    const proposal = makeProposal()
    useChatStore.setState({
      messages: [{ id: 'assistant-1', role: 'assistant', content: '确认', actionProposal: proposal }],
    })
    executeActionProposalCommand.mockRejectedValue(new Error('来源消息已变化'))

    const { confirmActionProposalCommand } = await import('@/services/actionProposalCommand')
    await confirmActionProposalCommand(proposal.id)

    const audit = useChatStore.getState().messages[0].actionProposal
    expect(audit).toMatchObject({ status: 'failed', errorCategory: 'target_changed' })
    expect(JSON.stringify({ kind: audit?.kind, status: audit?.status, errorCategory: audit?.errorCategory })).not.toContain('C:/')
  })
})
