/**
 * 命令行实时着色（类似 fish / zsh-syntax-highlighting）。
 *
 * 交给 xterm-readline 的 Highlighter 调用：它每次重绘都会用
 * `highlight(line, pos)` 的返回值拼出整行，光标位置则按**未着色**的原始行算，
 * 所以这里只能往字符之间插样式，绝不能增删字符。
 */

import { cyan, green, magenta, red, yellow } from '../term/ansi.ts'

export interface LineClassifier {
  isCommand(name: string): boolean
  isAlias(name: string): boolean
}

/** 成对引号或一段非空白 */
const TOKEN = /"[^"]*"|'[^']*'|\S+/g

const isQuoted = (token: string): boolean =>
  token.length >= 2 && (token[0] === '"' || token[0] === "'") && token.at(-1) === token[0]

function paint(token: string, index: number, classify: LineClassifier): string {
  if (isQuoted(token)) return green(token)

  if (index === 0) {
    if (classify.isAlias(token)) return magenta(token)
    return classify.isCommand(token) ? cyan(token) : red(token)
  }

  if (token.startsWith('-') && token.length > 1) return yellow(token)

  return token
}

/**
 * 给一行命令着色。返回值的可见字符必须和输入完全一致 —— 这是 readline 的
 * 光标定位前提。
 */
export function highlightLine(line: string, classify: LineClassifier): string {
  let out = ''
  let last = 0
  let index = 0

  for (const match of line.matchAll(TOKEN)) {
    const start = match.index
    out += line.slice(last, start)
    out += paint(match[0], index, classify)
    last = start + match[0].length
    index += 1
  }

  return out + line.slice(last)
}
