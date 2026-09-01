export const MAX_SUPPORTED_MARKDOWN_FILE_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_SUPPORTED_MARKDOWN_FILE_SIZE_LABEL = '5 MiB'

export class FileTooLargeError extends Error {
  readonly sizeBytes: number

  constructor(sizeBytes: number) {
    super(`文件大小为 ${formatFileSize(sizeBytes)}，当前仅支持不超过 ${MAX_SUPPORTED_MARKDOWN_FILE_SIZE_LABEL} 的文件`)
    this.name = 'FileTooLargeError'
    this.sizeBytes = sizeBytes
  }
}

export function assertSupportedMarkdownFileSize(sizeBytes: number): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    throw new Error('无法读取文件大小')
  }
  if (sizeBytes > MAX_SUPPORTED_MARKDOWN_FILE_SIZE_BYTES) {
    throw new FileTooLargeError(sizeBytes)
  }
}

export function isFileTooLargeError(error: unknown): error is FileTooLargeError {
  return error instanceof FileTooLargeError
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MiB`
}
