import { describe, expect, it, vi } from 'vitest'
import { MAX_SUPPORTED_MARKDOWN_FILE_SIZE_BYTES } from '@/services/fileSizeLimit'
import { restorePersistedTabs } from '@/services/sessionRestore'
import type { Tab } from '@/stores/editorStore'

function tab(): Tab {
  return {
    id: 'oversized',
    title: 'oversized.md',
    filePath: '/notes/oversized.md',
    content: 'cached content',
    savedContent: 'cached content',
    originalContent: 'cached content',
    modified: false,
  }
}

describe('session restore file size limit', () => {
  it('does not read the body of an oversized persisted file', async () => {
    const readFile = vi.fn(async () => 'should not be read')
    const issues: string[] = []

    const [restored] = await restorePersistedTabs([tab()], {
      getFileSize: async () => MAX_SUPPORTED_MARKDOWN_FILE_SIZE_BYTES + 1,
      readFile,
      onTabRestoreIssue: (issue) => issues.push(issue.kind),
    })

    expect(readFile).not.toHaveBeenCalled()
    expect(restored.content).toBe('cached content')
    expect(issues).toEqual(['too-large'])
  })
})
