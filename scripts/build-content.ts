/**
 * 内容编译器。跑在 node 里，只做构建期的事。
 *
 *   content/**.md  ──▶  元数据 → virtual:site-tree（内联进 bundle）
 *                  └──▶  正文   → /content/<path>（运行时 fetch 原始 .md）
 *
 * 正文不做任何重新生成：dev 下 Vite 插件直接读磁盘原文件吐出去，
 * build 后 prerender 原样拷进 dist/content/。全站只有 content/ 一份内容。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import matter from 'gray-matter'
import type { DocKind, DocMeta, SiteTree } from '../src/content/types.ts'

const ROOT = resolve(import.meta.dirname, '..')

export const CONTENT_DIR = join(ROOT, 'content')

/** 正文在站点里的 URL 前缀，运行时和中间件都按这个约定 */
export const TEXT_URL_PREFIX = '/content/'

function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) walk(path, acc)
        else if (/\.mdx?$/.test(entry)) acc.push(path)
    }
    return acc
}

/** 'blog/foo/index.md' → 'blog/foo'；'about.md' → 'about' */
function slugOf(rel: string): string {
    return rel
        .replace(/\\/g, '/')
        .replace(/\/index\.mdx?$/, '')
        .replace(/\.mdx?$/, '')
}

function kindOf(slug: string): DocKind {
    const head = slug.split('/')[0]
    if (head === 'blog') return 'post'
    if (head === 'projects') return 'project'
    return 'page'
}

function toDate(value: unknown): string | undefined {
    if (!value) return undefined
    if (value instanceof Date) return value.toISOString().slice(0, 10)
    return String(value).slice(0, 10)
}

/** frontmatter 的值统一成可显示的字符串 */
function formatValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (value instanceof Date) return value.toISOString().slice(0, 10)
    if (Array.isArray(value)) return value.map((item) => String(item)).join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

/** 原始 frontmatter，保持文件里的顺序，一个字段都不丢 */
function frontmatterRows(data: Record<string, unknown>): Array<[string, string]> {
    return Object.entries(data).map(([key, value]) => [key, formatValue(value)])
}

/** 非空白字符数。中文没有词边界，按字符算比按空格切词诚实。 */
function countChars(body: string): number {
    return body.replace(/\s+/g, '').length
}

export interface ReadResult extends SiteTree {
    /** 被跳过的草稿数 */
    readonly skipped: number
}

const collator = new Intl.Collator('zh-Hans-CN', { numeric: true })

export function readContent(contentDir = CONTENT_DIR): ReadResult {
    const docs: DocMeta[] = []
    let skipped = 0

    for (const file of walk(contentDir).sort()) {
        const rel = relative(contentDir, file).replace(/\\/g, '/')
        const slug = slugOf(rel)
        const parsed = matter(readFileSync(file, 'utf8'))
        const data = parsed.data as Record<string, unknown>

        if (data.draft === true) {
            skipped += 1
            continue
        }

        docs.push({
            slug,
            path: rel,
            title: String(data.title ?? data.name ?? slug.split('/').pop() ?? slug),
            description: data.description ? String(data.description) : undefined,
            date: toDate(data.pubDate ?? data.date),
            tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
            chars: countChars(parsed.content),
            kind: kindOf(slug),
            frontmatter: frontmatterRows(data),
        })
    }

    docs.sort((a, b) => collator.compare(a.slug, b.slug))
    return { docs, skipped }
}
