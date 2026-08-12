import type { Chunk } from './types'
import { createExactContentHash } from './contentHash'

export const EMBEDDING_PREPROCESS_VERSION = 'markdown-chunk-v2'
export const EMBEDDING_INPUT_MAX_CHARS = 6000

export interface EmbeddingInputPart {
  text: string
  partIndex: number
  startLine: number
  endLine: number
}

export function getEmbeddingInput(chunk: Pick<Chunk, 'content'>): string {
  return chunk.content
}

export function createEmbeddingInputHash(chunk: Pick<Chunk, 'content'>): Promise<string> {
  return createExactContentHash(getEmbeddingInput(chunk))
}

function countNewlines(value: string): number {
  let count = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) === 10) count += 1
  }
  return count
}

function findSafeEnd(content: string, start: number, maxChars: number): number {
  let end = Math.min(content.length, start + maxChars)
  if (end >= content.length) return end

  const window = content.slice(start, end)
  const minimumBoundary = Math.floor(maxChars / 2)
  const newline = window.lastIndexOf('\n')
  if (newline >= minimumBoundary) {
    end = start + newline + 1
  } else {
    for (let index = window.length - 1; index >= minimumBoundary; index -= 1) {
      if (/\s/u.test(window[index])) {
        end = start + index + 1
        break
      }
    }
  }

  if (content.charCodeAt(end - 1) >= 0xD800 && content.charCodeAt(end - 1) <= 0xDBFF) {
    end -= 1
  }
  if (content[end - 1] === '\r' && content[end] === '\n') end -= 1
  return end > start ? end : Math.min(content.length, start + maxChars)
}

/**
 * Split only the provider input. The persisted/displayed parent chunk remains unchanged.
 */
export function buildEmbeddingInputs(
  chunk: Pick<Chunk, 'content' | 'startLine' | 'endLine'>,
  maxChars = EMBEDDING_INPUT_MAX_CHARS,
): EmbeddingInputPart[] {
  const limit = Math.max(1, Math.floor(maxChars))
  const parts: EmbeddingInputPart[] = []
  let offset = 0
  let startLine = chunk.startLine

  do {
    const end = findSafeEnd(chunk.content, offset, limit)
    const text = chunk.content.slice(offset, end)
    const newlineCount = countNewlines(text)
    const endLine = Math.min(
      chunk.endLine,
      Math.max(startLine, startLine + newlineCount - (text.endsWith('\n') ? 1 : 0)),
    )
    parts.push({ text, partIndex: parts.length, startLine, endLine })
    startLine += newlineCount
    offset = end
  } while (offset < chunk.content.length)

  return parts
}

export function averageEmbeddingVectors(vectors: readonly number[][]): number[] | undefined {
  const dimension = vectors[0]?.length || 0
  if (dimension === 0 || vectors.some((vector) => (
    vector.length !== dimension || vector.some((value) => !Number.isFinite(value))
  ))) return undefined

  const average = Array<number>(dimension).fill(0)
  for (const vector of vectors) {
    for (let index = 0; index < dimension; index += 1) average[index] += vector[index]
  }
  return average.map((value) => value / vectors.length)
}
