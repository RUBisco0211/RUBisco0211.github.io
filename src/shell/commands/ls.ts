import { cyan, dim, green, red, yellow } from '../../term/ansi.ts'
import { padEnd, visibleWidth } from '../../term/width.ts'
import { completePath } from '../complete.ts'
import { lookup, type FileEntry } from '../fs.ts'
import type { Command } from '../types.ts'

/** 1786 → '1.8k'，832 → '832' */
function formatChars(count: number): string {
  if (count <= 0) return '-'
  if (count < 1000) return String(count)
  const k = count / 1000
  return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`
}

/**
 * 每格自带颜色，`render` 只负责对齐。
 * 缺数据的地方统一用压暗的 '-'，不要让它抢到和真实值一样的分量。
 */
interface Row {
  kind: string
  date: string
  chars: string
  name: string
  tags: string
}

const HEADER: Row = {
  kind: dim('类型'),
  date: dim('日期'),
  chars: dim('字数'),
  name: dim('名称'),
  tags: dim('标签'),
}

const EMPTY = dim('-')

function fileRow(file: FileEntry): Row {
  return {
    kind: dim(file.kind),
    date: file.date ? dim(file.date) : EMPTY,
    chars: file.chars > 0 ? yellow(formatChars(file.chars)) : EMPTY,
    name: file.name,
    tags: file.tags.length > 0 ? green(file.tags.join(' ')) : EMPTY,
  }
}

function dirRow(name: string): Row {
  // 目录没有日期和篇幅，用 '-' 占位而不是编一个值出来
  return { kind: dim('dir'), date: EMPTY, chars: EMPTY, name: cyan(`${name}/`), tags: EMPTY }
}

/** 按每列的最大显示宽度补齐（visibleWidth 会忽略颜色序列） */
function render(rows: readonly Row[], header: Row | undefined): string[] {
  const all = header ? [header, ...rows] : rows
  const width = {
    kind: Math.max(...all.map((row) => visibleWidth(row.kind))),
    date: Math.max(...all.map((row) => visibleWidth(row.date))),
    chars: Math.max(...all.map((row) => visibleWidth(row.chars))),
    name: Math.max(...all.map((row) => visibleWidth(row.name))),
  }

  const line = (row: Row): string =>
    [
      padEnd(row.kind, width.kind),
      padEnd(row.date, width.date),
      padEnd(row.chars, width.chars),
      padEnd(row.name, width.name),
      row.tags,
    ]
      .join('  ')
      .trimEnd()

  const out = rows.map(line)
  if (header) out.unshift(line(header))
  return out
}

const ls: Command = {
  name: 'ls',
  description: '列出目录内容',
  usage: 'ls [路径]',
  complete: (ctx, _argv, current) => completePath(ctx, current),
  run(ctx, args) {
    const target = args[0] ?? '.'
    const found = lookup(ctx.fs, ctx.cwd, target)

    if (found.kind === 'missing') {
      ctx.term.println(red(`没有这个路径：${target}`))
      return
    }

    // 指向单个文件时只打它自己那一行，不带表头
    if (found.kind === 'file') {
      for (const line of render([fileRow(found.file)], undefined)) ctx.term.println(line)
      return
    }

    const { dirs, files } = found.node
    if (dirs.length === 0 && files.length === 0) {
      ctx.term.println(dim('（空目录）'))
      return
    }

    const rows = [...dirs.map(dirRow), ...files.map(fileRow)]
    for (const line of render(rows, HEADER)) ctx.term.println(line)
  },
}

export default ls
