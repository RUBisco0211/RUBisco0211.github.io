import type { DocMeta, SiteTree } from './types.ts'

/**
 * 运行时对内容树的只读视图。
 *
 * 元数据来自编译期内联的 site-tree；正文直接 fetch content/ 里的原始 .md
 * （路径来自 doc.path，不改名、不预生成），拉过一次就缓存。
 */
export interface ContentStore {
    readonly docs: readonly DocMeta[]
    find(slug: string): DocMeta | undefined
    text(slug: string): Promise<string | undefined>
}

// node 下（测试）没有 import.meta.env，退回根路径
const BASE = import.meta.env?.BASE_URL ?? '/'

/** 去掉开头的 frontmatter 块 —— 元数据已经在 doc 里了，cat 时不该再显示一遍 */
export function stripFrontmatter(text: string): string {
    return (
        text
            .replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '')
            // frontmatter 后面通常还空一行，一并吃掉，免得 cat 里多出个空行
            .replace(/^(?:[ \t]*\r?\n)+/, '')
    )
}

export function createContentStore(tree: SiteTree): ContentStore {
    const bySlug = new Map(tree.docs.map((doc) => [doc.slug, doc]))
    const cache = new Map<string, string>()

    return {
        docs: tree.docs,

        find: (slug) => bySlug.get(slug),

        async text(slug) {
            const cached = cache.get(slug)
            if (cached !== undefined) return cached

            const doc = bySlug.get(slug)
            if (!doc) return undefined

            const url = `${BASE}content/${doc.path.split('/').map(encodeURIComponent).join('/')}`
            const response = await fetch(url)
            if (!response.ok) return undefined

            const text = stripFrontmatter(await response.text())
            cache.set(slug, text)
            return text
        },
    }
}
