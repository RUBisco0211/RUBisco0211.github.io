export interface SiteConfig {
  user: string
  host: string
  defaultTheme: string
  fontSize: number
  /** 行高倍数。像素画（neofetch）依赖 customGlyphs 填满整格，改动前先看效果 */
  lineHeight: number
  fontFamily: string
  aliases: Record<string, string>
  /**
   * 启动后自动执行一次的命令，相当于帮你敲了一次回车。
   * 留空就不执行。比如填 'neofetch' 让首屏直接显示站点信息。
   */
  startupCommand: string
  /** neofetch 里展示的个人信息，按顺序输出；带 href 的会变成可点链接 */
  profile: ReadonlyArray<{ label: string; value: string; href?: string }>
}

export const config: SiteConfig = {
  user: 'rubisco',
  host: 'tty.blog',
  defaultTheme: 'github',
  fontSize: 13,
  lineHeight: 1.4,
  fontFamily:
    '"Maple Mono NF", "Maple Mono", "Maple Mono NF CN", ui-monospace, "PingFang SC", "Microsoft YaHei", monospace',
  startupCommand: 'neofetch',
  profile: [
    { label: 'Name', value: 'RUBisco' },
    { label: 'Location', value: 'Nanjing / Fuzhou' },
    { label: 'Blog', value: 'rublog-astro', href: 'https://rublog-astro.netlify.app/' },
    { label: 'GitHub', value: 'RUBisco0211', href: 'https://github.com/RUBisco0211' },
  ],
  aliases: {
    blog: 'ls blog',
    projects: 'ls projects',
    clr: 'clear',
  },
}
