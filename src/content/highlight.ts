/**
 * 语法着色。
 *
 * 词法分析交给 @speed-highlight/core（同步的 tokenizeWith），
 * 我们只做两件事：语言别名映射，以及把 token 类型接到本项目的 ANSI 样式上。
 * 这样颜色跟着主题走，而不是写死一套调色板。
 */

import { tokenizeWith } from '@speed-highlight/core/tokenize'
import type { ShjLanguageData, ShjToken } from '@speed-highlight/core/tokenize'
import bash from '@speed-highlight/core/languages/bash.js'
import diff from '@speed-highlight/core/languages/diff.js'
import go from '@speed-highlight/core/languages/go.js'
import js from '@speed-highlight/core/languages/js.js'
import json from '@speed-highlight/core/languages/json.js'
import md from '@speed-highlight/core/languages/md.js'
import py from '@speed-highlight/core/languages/py.js'
import ts from '@speed-highlight/core/languages/ts.js'
import yaml from '@speed-highlight/core/languages/yaml.js'
import { blue, cyan, dim, green, magenta, red, yellow, type Style } from '../term/ansi.ts'

export type Lang = 'bash' | 'js' | 'ts' | 'json' | 'yaml' | 'diff' | 'go' | 'py' | 'md' | 'plain'

const GRAMMARS: Record<Exclude<Lang, 'plain'>, ShjLanguageData> = {
  bash,
  js,
  ts,
  json,
  yaml,
  diff,
  go,
  py,
  md,
}

/** 子语法可能引用别的语言，全部登记进去 */
const LANGUAGES: Record<string, ShjLanguageData> = { ...GRAMMARS }

/** token 类型 → 本项目样式。没列出的类型保持默认前景色。 */
const STYLES: Partial<Record<ShjToken, Style>> = {
  kwd: cyan,
  str: green,
  cmnt: dim,
  num: yellow,
  class: yellow,
  var: magenta,
  bool: magenta,
  section: magenta,
  func: magenta,
  esc: magenta,
  type: blue,
  oper: blue,
  insert: green,
  deleted: red,
  err: red,
}

const ALIASES: Record<string, Lang> = {
  sh: 'bash',
  shell: 'bash',
  bash: 'bash',
  zsh: 'bash',
  console: 'bash',
  powershell: 'bash',
  js: 'js',
  javascript: 'js',
  jsx: 'js',
  ts: 'ts',
  typescript: 'ts',
  tsx: 'ts',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  diff: 'diff',
  patch: 'diff',
  go: 'go',
  python: 'py',
  py: 'py',
  md: 'md',
  markdown: 'md',
}

export function normalizeLang(lang: string | undefined): Lang {
  if (!lang) return 'plain'
  return ALIASES[lang.trim().toLowerCase()] ?? 'plain'
}

export function grammarFor(lang: Lang): ShjLanguageData | undefined {
  return lang === 'plain' ? undefined : GRAMMARS[lang]
}

/**
 * 整块着色。返回的字符串里带 ANSI，调用方按行切分时不要打乱转义序列 ——
 * 只做行首缩进是安全的。
 */
export function highlightCode(code: string, lang: Lang): string {
  if (lang === 'plain')
    return code
      .split('\n')
      .map((line) => dim(line))
      .join('\n')

  let out = ''
  tokenizeWith(
    code,
    GRAMMARS[lang],
    (text, type) => {
      const style = type ? STYLES[type] : undefined
      out += style ? style(text) : text
    },
    { languages: LANGUAGES },
  )
  return out
}
