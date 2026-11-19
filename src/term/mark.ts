/**
 * 在带 ANSI 的一行里把匹配到的片段反显出来。
 *
 * 难点是"定位"：转义序列本身也占字符串下标，但不能算进可见文本。所以先走一遍
 * 建立「可见字符下标 → 原始下标」的映射，再按映射插反显码。
 */

import { stripAnsi } from './width.ts'

const ESCAPE = /\x1b\[[0-9;]*m|\x1b\]8;;[^\x1b]*\x1b\\/y

const INVERSE_ON = '\x1b[7m'
const INVERSE_OFF = '\x1b[27m'

/** 可见文本 + 每个可见字符对应的原始下标 */
function splitAnsi(line: string): { plain: string; map: number[] } {
  let plain = ''
  const map: number[] = []
  let index = 0

  while (index < line.length) {
    ESCAPE.lastIndex = index
    const escape = ESCAPE.exec(line)
    if (escape) {
      index += escape[0].length
      continue
    }

    const char = String.fromCodePoint(line.codePointAt(index) ?? 0)
    plain += char
    map.push(index)
    index += char.length
  }

  return { plain, map }
}

/** 把所有 query（忽略大小写）反显。query 为空时原样返回。 */
export function markMatches(line: string, query: string): string {
  const needle = query.trim()
  if (needle === '') return line

  const { plain, map } = splitAnsi(line)
  const haystack = plain.toLowerCase()
  const target = needle.toLowerCase()

  const parts: string[] = []
  let raw = 0
  let from = 0

  for (;;) {
    const at = haystack.indexOf(target, from)
    if (at === -1) break

    const start = map[at]
    if (start === undefined) break

    const endAt = at + target.length
    const end = endAt < map.length ? map[endAt]! : line.length

    parts.push(line.slice(raw, start), INVERSE_ON, line.slice(start, end), INVERSE_OFF)
    raw = end
    from = endAt
  }

  parts.push(line.slice(raw))
  return parts.join('')
}

/** 这行是否命中（用于统计匹配行） */
export function matchesQuery(line: string, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return false
  return stripAnsi(line).toLowerCase().includes(needle)
}
