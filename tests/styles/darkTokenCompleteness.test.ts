import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 深色主题 token 完整性回归：
 * light.css / official-light.css 的主题作用域块里定义的每个 --gm-* 语义 token，
 * dark.css 必须有同名定义。缺失时深色模式会回落到 light.css :root 的暖白值
 * （历史事故：设置弹窗、tooltip、全屏控制条在深色下整体发白）。
 * 仅比较主题作用域块：light.css :root 里的排版/间距/圆角等与主题无关，不要求深色重复。
 */
function collectThemeScopedGmTokens(css: string): Set<string> {
  const names = new Set<string>()
  const blockPattern = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = blockPattern.exec(css)) !== null) {
    const selector = match[1]
    if (!selector.includes('data-theme')) continue
    for (const declaration of match[2].matchAll(/--gm-[a-z0-9-]+(?=\s*:)/g)) {
      names.add(declaration[0])
    }
  }
  return names
}

describe('深色主题 token 完整性', () => {
  const readTokenFile = (name: string): string =>
    readFileSync(resolve(process.cwd(), 'src/styles/tokens', name), 'utf8')

  const lightTokens = new Set<string>([
    ...collectThemeScopedGmTokens(readTokenFile('light.css')),
    ...collectThemeScopedGmTokens(readTokenFile('official-light.css')),
  ])
  const darkTokens = collectThemeScopedGmTokens(readTokenFile('dark.css'))

  it('浅色主题作用域内的 --gm-* 在深色主题中都有同名定义', () => {
    const missing = [...lightTokens].filter((name) => !darkTokens.has(name)).sort()
    expect(missing, `dark.css 缺少: ${missing.join(', ')}`).toEqual([])
  })

  it('历史事故相关家族显式存在（tooltip/设置弹窗/全屏控制条/悬停边框）', () => {
    for (const name of [
      '--gm-border-hover',
      '--gm-tooltip-bg',
      '--gm-tooltip-border',
      '--gm-tooltip-shadow',
      '--gm-settings-mask-bg',
      '--gm-settings-modal-bg',
      '--gm-settings-modal-border',
      '--gm-settings-modal-shadow',
      '--gm-fullscreen-control-bg',
      '--gm-fullscreen-control-border',
      '--gm-fullscreen-control-shadow',
      '--gm-fullscreen-control-hover',
      '--gm-fullscreen-control-text',
      '--gm-fullscreen-control-muted',
    ]) {
      expect(darkTokens.has(name), `${name} 必须在 dark.css 中定义`).toBe(true)
    }
  })
})
