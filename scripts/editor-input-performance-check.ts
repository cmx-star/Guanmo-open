import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { DeferredContentEmitter } from '@/services/editorInputBuffer'

for (const size of [50_000, 200_000]) {
  let serialized = 0
  let emitted = ''
  const emitter = new DeferredContentEmitter<{ content: string }>(
    (value) => {
      serialized += 1
      return value.content
    },
    (content) => { emitted = content }
  )
  const base = '# heading\n'.padEnd(size, 'x')
  const startedAt = performance.now()
  for (let index = 0; index < 100; index += 1) {
    emitter.push({ content: `${base}${index}` }, size + String(index).length)
  }
  const schedulingMs = performance.now() - startedAt
  assert.equal(serialized, 0, `${size} 文档逐键阶段不得序列化全文`)
  emitter.flush()
  assert.equal(serialized, 1, `${size} 文档一批输入只允许一次全文序列化`)
  assert.ok(emitted.endsWith('99'))
  assert.ok(schedulingMs < 100, `${size} 文档 100 次输入调度耗时异常：${schedulingMs.toFixed(1)}ms`)
  emitter.dispose()
  console.log(`${size} chars: 100 updates scheduled in ${schedulingMs.toFixed(1)}ms, serializations=${serialized}`)
}

console.log('editor input performance checks passed')
