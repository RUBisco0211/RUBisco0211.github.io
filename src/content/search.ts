import type { ContentStore } from './store.ts'
import type { DocMeta } from './types.ts'

export interface SearchHit {
    readonly doc: DocMeta
    readonly score: number
    readonly snippet: string
}

const SNIPPET_RADIUS = 30

function countOccurrences(haystack: string, needle: string): number {
    if (needle === '') return 0
    let count = 0
    let at = haystack.indexOf(needle)
    while (at !== -1) {
        count += 1
        at = haystack.indexOf(needle, at + needle.length)
    }
    return count
}

function makeSnippet(text: string, term: string): string {
    const at = text.toLowerCase().indexOf(term)
    if (at === -1) return ''

    const start = Math.max(0, at - SNIPPET_RADIUS)
    const end = Math.min(text.length, at + term.length + SNIPPET_RADIUS)
    const slice = text.slice(start, end).replace(/\s+/g, ' ').trim()
    return `${start > 0 ? '…' : ''}${slice}${end < text.length ? '…' : ''}`
}

/**
 * 线性扫描搜索。
 *
 * 内容量在几十篇这个量级，全量扫一遍是微秒级的，不需要倒排索引 ——
 * 更重要的是中文：倒排索引要分词，而 substring 匹配对中文是天然正确的，
 * 用户输"迁移"就能命中"从nvm迁移到fnm"。
 *
 * 打分：标题 > 标签 > 正文出现次数。多个词按 AND 匹配。
 */
export async function searchDocs(store: ContentStore, query: string): Promise<SearchHit[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return []

    const hits: SearchHit[] = []

    for (const doc of store.docs) {
        const title = doc.title.toLowerCase()
        const tags = doc.tags.join(' ').toLowerCase()
        const body = (await store.text(doc.slug)) ?? ''
        const lowerBody = body.toLowerCase()

        let score = 0
        let snippet = ''

        for (const term of terms) {
            let termScore = 0
            if (title.includes(term)) termScore += 100
            if (tags.includes(term)) termScore += 40

            const occurrences = countOccurrences(lowerBody, term)
            if (occurrences > 0) termScore += 10 + Math.min(occurrences, 5) * 2

            // 每个词都得出现，少一个就整篇不算命中
            if (termScore === 0) {
                score = 0
                break
            }

            score += termScore
            if (snippet === '') snippet = makeSnippet(body, term)
        }

        if (score === 0) continue
        hits.push({ doc, score, snippet: snippet || doc.description || '' })
    }

    return hits.sort(
        (a, b) => b.score - a.score || (b.doc.date ?? '').localeCompare(a.doc.date ?? ''),
    )
}
