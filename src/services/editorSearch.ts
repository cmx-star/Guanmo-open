/**
 * 编辑器 / 预览搜索公共工具。
 *
 * findNearestMatchIndex：返回离锚点最近的匹配下标（搜索跳最近位置）。
 * - 无锚点 / 空匹配 → 0（保持现状：跳文档首个匹配）。
 * - 锚点在前/中/后时选择距离最近者。
 * - 距离平局时取 from >= anchor 的后者（搜索方向优先）。
 */

export interface SearchMatchRange {
  from: number
  to: number
}

export function findNearestMatchIndex(items: Array<{ from: number; to: number }>, anchor?: number): number {
  if (!items.length || anchor === undefined) return 0
  return items.reduce((best, item, index) =>
    Math.abs(item.from - anchor) < Math.abs(items[best].from - anchor)
      || (Math.abs(item.from - anchor) === Math.abs(items[best].from - anchor) && item.from >= anchor)
      ? index
      : best,
  0)
}
