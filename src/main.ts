import './styles.css'
import '@fontsource/maple-mono/400.css'
import '@fontsource/maple-mono/400-italic.css'
import '@fontsource/maple-mono/700.css'
import { config } from './config.ts'
import { content } from './content/index.ts'
import { commands } from './shell/commands/index.ts'
import { commonPrefix, completeLine } from './shell/complete.ts'
import { buildFs } from './shell/fs.ts'
import { highlightLine } from './shell/highlight-line.ts'
import { lookup } from './shell/fs.ts'
import { createShell } from './shell/index.ts'
import { displayPath } from './shell/path.ts'
import { padEnd, visibleWidth } from './term/width.ts'
import { blue, bold, dim, green, red } from './term/ansi.ts'
import { Term } from './term/terminal.ts'
import { defaultThemeName, findTheme } from './theme/index.ts'
import { createThemeStore } from './theme/store.ts'

const app = document.getElementById('app')
const host = document.getElementById('term')
if (!app || !host) throw new Error('缺少 #app 或 #term 容器')

const initial = findTheme(config.defaultTheme) ?? findTheme(defaultThemeName)

const term = new Term(host, {
  // 先用深色变体起步，createThemeStore 会立刻按系统偏好换成正确的那个
  theme: initial?.dark.xterm ?? {},
  // 手机上 14px 太占地方，45 列的 neofetch art 也会塞不下
  fontSize: window.innerWidth < 600 ? 12 : config.fontSize,
  lineHeight: config.lineHeight,
  fontFamily: config.fontFamily,
})

// 终端已经挂上了，撤掉首屏占位
document.getElementById('boot')?.remove()

const theme = createThemeStore(term, config.defaultTheme)
const fs = buildFs(content.docs)
const shell = createShell({
  term,
  theme,
  config,
  fs,
  content,
  commands,
  aliases: config.aliases,
})

// 实时着色：认得的命令青色、别名品红、不认识的红色、选项黄、路径分存在与否
term.setLineHighlighter((line) =>
  highlightLine(line, {
    isCommand: (name) => shell.ctx.registry.get(name) !== undefined,
    isAlias: (name) => name in config.aliases,
    resolvePath: (token) => lookup(shell.ctx.fs, shell.ctx.cwd, token).kind,
  }),
)

const prompt = (): string =>
  `${green(`${config.user}@${config.host}`)}:${blue(displayPath(shell.ctx.cwd))}$ `

/** Tab：一个候选直接补，多个补到公共前缀，补不动就列出来 */
function handleTab(): void {
  const line = term.readline.getLine()
  const { candidates, from, to } = completeLine(shell.ctx, line)
  if (candidates.length === 0) return

  const splice = (value: string): string => line.slice(0, from) + value + line.slice(to)

  if (candidates.length === 1) {
    term.readline.updateLine(splice(candidates[0]!.value))
    return
  }

  const prefix = commonPrefix(candidates.map((candidate) => candidate.value))
  if (prefix.length > line.length - from) {
    term.readline.updateLine(splice(prefix))
    return
  }

  // 一行一个，方便逐个看；有描述的补在后面
  const width = candidates.reduce(
    (max, candidate) => Math.max(max, visibleWidth(candidate.value)),
    0,
  )
  term.showCompletions(
    candidates.map((candidate) =>
      candidate.description
        ? `${padEnd(candidate.value, width)}  ${dim(candidate.description)}`
        : candidate.value,
    ),
  )
}

term.onTab(handleTab)

term.println(`${bold('tty.blog')} ${dim('— 输入 help 查看可用命令')}`)
term.println()

async function loop(): Promise<void> {
  for (;;) {
    let line: string
    try {
      line = await term.read(prompt(), shell.takePrefill())
    } catch {
      // Ctrl-C 取消 / abort，重开一次提示符
      continue
    }
    if (!line.trim()) continue

    try {
      await shell.run(line)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      term.println(red(message))
    }
  }
}

app.addEventListener('click', () => term.focus())
term.focus()

/** 先跑一次启动命令，再进正常的 REPL 循环 */
async function boot(): Promise<void> {
  const startup = config.startupCommand.trim()
  if (startup) {
    try {
      await shell.run(startup)
    } catch (error) {
      term.println(red(error instanceof Error ? error.message : String(error)))
    }
  }
  await loop()
}

void boot()
