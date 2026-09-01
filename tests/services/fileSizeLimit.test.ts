import { describe, expect, it } from 'vitest'
import {
  assertSupportedMarkdownFileSize,
  FileTooLargeError,
  MAX_SUPPORTED_MARKDOWN_FILE_SIZE_BYTES,
} from '@/services/fileSizeLimit'

describe('Markdown file size limit', () => {
  it('accepts files at the supported size limit', () => {
    expect(() => assertSupportedMarkdownFileSize(MAX_SUPPORTED_MARKDOWN_FILE_SIZE_BYTES)).not.toThrow()
  })

  it('rejects files above the supported size limit', () => {
    expect(() => assertSupportedMarkdownFileSize(MAX_SUPPORTED_MARKDOWN_FILE_SIZE_BYTES + 1))
      .toThrow(FileTooLargeError)
  })
})
