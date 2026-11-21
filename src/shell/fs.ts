/**
 * 虚拟文件系统。
 *
 * 由内容编译器的输出（一组 slug）推导出来，运行时只读。
 * 目录结构完全由 slug 决定：
 *
 *   slug 'blog/从nvm迁移到fnm'  →  /blog/从nvm迁移到fnm
 *
 * 所以内容想嵌套（比如 blog/2026/xxx）不需要改这里，slug 里带斜杠就行。
 */

import type { DocKind, DocMeta } from '@/content/types.ts'
import { normalize, resolvePath, splitPath } from './path.ts'

export type { DocKind, DocMeta }

/** 文件系统里的一个条目：元数据 + 由 slug 最后一段推出的名字 */
export interface FileEntry extends DocMeta {
    readonly name: string
}

export interface FsNode {
    readonly dirs: readonly string[]
    readonly files: readonly FileEntry[]
}

export type Fs = ReadonlyMap<string, FsNode>

const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })

export function buildFs(docs: readonly DocMeta[]): Fs {
    const draft = new Map<string, { dirs: Set<string>; files: FileEntry[] }>()

    const node = (path: string) => {
        let found = draft.get(path)
        if (!found) {
            found = { dirs: new Set(), files: [] }
            draft.set(path, found)
        }
        return found
    }

    node('/')

    for (const doc of docs) {
        const abs = normalize(`/${doc.slug}`)
        const { dir, base } = splitPath(abs)
        if (base === '') continue

        // 逐级补出祖先目录，'/' 也要登记
        let cur = ''
        for (const seg of dir.split('/').filter(Boolean)) {
            node(cur === '' ? '/' : cur).dirs.add(seg)
            cur = `${cur}/${seg}`
            node(cur)
        }

        node(dir).files.push({ ...doc, name: base })
    }

    const fs = new Map<string, FsNode>()
    for (const [path, entry] of draft) {
        fs.set(path, {
            dirs: [...entry.dirs].sort(collator.compare),
            files: entry.files.sort((a, b) => collator.compare(a.name, b.name)),
        })
    }
    return fs
}

export function getNode(fs: Fs, abs: string): FsNode | undefined {
    return fs.get(normalize(abs))
}

function findFile(fs: Fs, abs: string): FileEntry | undefined {
    const { dir, base } = splitPath(abs)
    const dirPath = canonicalPath(fs, dir)
    if (dirPath === undefined) return undefined
    const needle = base.toLowerCase()
    return fs.get(dirPath)?.files.find((file) => file.name.toLowerCase() === needle)
}

/** fs 里的真实路径可能大小写不同，按小写比较找回规范写法 */
function canonicalPath(fs: Fs, path: string): string | undefined {
    if (fs.has(path)) return path
    const needle = path.toLowerCase()
    for (const key of fs.keys()) {
        if (key.toLowerCase() === needle) return key
    }
    return undefined
}

export type Target =
    | { kind: 'dir'; path: string; node: FsNode }
    | { kind: 'file'; path: string; file: FileEntry }
    | { kind: 'missing'; path: string }

/**
 * 把「相对 cwd 的用户输入」解析成一个存在的目标。
 * 顺带接受带扩展名的写法：cat hello.md 等价于 cat hello。
 * 大小写不敏感：cd Blog 和 cd blog 等价，返回的 path 用真实大小写。
 */
export function lookup(fs: Fs, cwd: string, arg: string): Target {
    const path = resolvePath(cwd, arg)
    return (
        lookupAbs(fs, path) ??
        lookupAbs(fs, path.replace(/\.mdx?$/i, '')) ?? { kind: 'missing', path }
    )
}

function lookupAbs(fs: Fs, path: string): Target | undefined {
    const dirPath = canonicalPath(fs, path)
    if (dirPath !== undefined) return { kind: 'dir', path: dirPath, node: fs.get(dirPath)! }

    const file = findFile(fs, path)
    if (file) {
        const { dir } = splitPath(path)
        const dirPath = canonicalPath(fs, dir) ?? dir
        return { kind: 'file', path: `${dirPath === '/' ? '' : dirPath}/${file.name}`, file }
    }
    return undefined
}
