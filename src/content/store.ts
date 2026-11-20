import type { DocMeta, SiteTree } from './types.ts'
import { stripFrontmatter } from './frontmatter.ts'

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
