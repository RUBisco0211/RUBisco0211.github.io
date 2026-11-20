/** 去掉开头的 frontmatter 块 —— 元数据已经在 doc 里了，cat 时不该再显示一遍 */
export function stripFrontmatter(text: string): string {
    return (
        text
            .replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '')
            // frontmatter 后面通常还空一行，一并吃掉，免得 cat 里多出个空行
            .replace(/^(?:[ \t]*\r?\n)+/, '')
    )
}
