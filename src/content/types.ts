/**
 * 内容层的数据契约。
 *
 * 编译器（node 侧）产出 SiteTree，运行时（浏览器侧）只读它。
 * 这里不依赖 DOM、不依赖 xterm，所以两边都能 import。
 */

export type DocKind = 'post' | 'project' | 'page'

export interface DocMeta {
  /** 路径即身份：'blog/从nvm迁移到fnm'、'about' */
  readonly slug: string
  /** 源文件相对 content/ 的路径，正文就按这个路径取，不做任何改名 */
  readonly path: string
  readonly title: string
  readonly description?: string
  /** 'YYYY-MM-DD' */
  readonly date?: string
  readonly tags: readonly string[]
  /** 非空白字符数，用来显示篇幅 */
  readonly chars: number
  readonly kind: DocKind
  /**
   * 原始 frontmatter，按文件里的顺序，值已经格式化成字符串。
   * cat / open 直接把它当元信息表渲染，不再从上面那些映射字段拼。
   */
  readonly frontmatter: ReadonlyArray<readonly [string, string]>
}

export interface SiteTree {
  readonly docs: readonly DocMeta[]
}
