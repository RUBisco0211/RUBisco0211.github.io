import { cyan, red } from '../../term/ansi.ts'
import { completePath } from '../complete.ts'
import { getNode, lookup, type Fs } from '../fs.ts'
import { displayPath, normalize } from '../path.ts'
import type { Command } from '../types.ts'

/**
 * 把虚拟文件系统画成树。
 *
 * 纯函数，返回带 ANSI 的行；目录青色带斜杠，文件用默认色。
 * 目录和文件各自按名字排好序（buildFs 保证的），所以这里只管缩进。
 */
export function treeLines(fs: Fs, root: string): string[] {
  const lines = [displayPath(root)]

  const walk = (path: string, prefix: string): void => {
    const node = getNode(fs, path)
    if (!node) return

    const entries = [
      ...node.dirs.map((name) => ({ name, dir: true })),
      ...node.files.map((file) => ({ name: file.name, dir: false })),
    ]

    entries.forEach((entry, index) => {
      const last = index === entries.length - 1
      const branch = last ? '└── ' : '├── '
      const label = entry.dir ? cyan(`${entry.name}/`) : entry.name
      lines.push(`${prefix}${branch}${label}`)

      if (entry.dir) {
        walk(normalize(`${path}/${entry.name}`), `${prefix}${last ? '    ' : '│   '}`)
      }
    })
  }

  walk(root, '')
  return lines
}

const tree: Command = {
  name: 'tree',
  description: '树形列出目录内容',
  usage: 'tree [路径]',
  complete: (ctx, _argv, current) => completePath(ctx, current),
  run(ctx, args) {
    const target = args[0] ?? '.'
    const found = lookup(ctx.fs, ctx.cwd, target)

    if (found.kind === 'missing') {
      ctx.term.println(red(`没有这个路径：${target}`))
      return
    }

    if (found.kind === 'file') {
      ctx.term.println(found.file.name)
      return
    }

    for (const line of treeLines(ctx.fs, found.path)) ctx.term.println(line)
  },
}

export default tree
