/**
 * 内容层的数据类型
 *
 */

export type DocKind = 'post' | 'project' | 'page'

export interface DocMeta {
    readonly slug: string
    readonly path: string
    readonly title: string
    readonly description?: string
    /** 'YYYY-MM-DD' */
    readonly date?: string
    readonly tags: readonly string[]
    /** 非空白字符数，用来统计篇幅 */
    readonly chars: number
    readonly kind: DocKind
    /**
     * 原始 frontmatter，按文件里的顺序，值已经格式化成字符串
     */
    readonly frontmatter: ReadonlyArray<readonly [string, string]>
}

export interface SiteTree {
    readonly docs: readonly DocMeta[]
}
