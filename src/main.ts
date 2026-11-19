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
import { createShell } from './shell/index.ts'
import { displayPath } from './shell/path.ts'
import { padEnd, visibleWidth } from './term/width.ts'
import { blue, dim, green, red } from './term/ansi.ts'
import { Term } from './term/terminal.ts'
import { findTheme } from './theme/index.ts'
import { createThemeStore } from './theme/store.ts'

const app = document.getElementById('app')
const host = document.getElementById('term')
if (!app || !host) throw new Error('缺少 #app 或 #term 容器')

const initial = findTheme(config.defaultTheme)

const term = new Term(host, {
    theme: initial?.dark.xterm ?? {},
    fontSize: config.fontSize,
    lineHeight: config.lineHeight,
    fontFamily: config.fontFamily,
})

// 终端挂上即可撤掉首屏 loading 占位符
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

// 实时着色：认得的命令青色、别名品红、不认识的红色、选项黄、引号内容绿
term.setLineHighlighter((line) =>
    highlightLine(line, {
        isCommand: (name) => shell.ctx.registry.get(name) !== undefined,
        isAlias: (name) => name in config.aliases,
    }),
)

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

    // 显示多个候选
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

/**
 * prompt 循环
 */
async function loop(): Promise<void> {
    const prompt = (): string =>
        `${green(`${config.user}@${config.host}`)}:${blue(displayPath(shell.ctx.cwd))}$ `

    for (;;) {
        let line: string
        try {
            line = await term.read(prompt(), shell.takePrefill())
        } catch {
            // ctrl-c
            continue
        }
        if (!line.trim()) continue

        // 拿到命令行去执行
        try {
            await shell.run(line)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            term.println(red(message))
        }
    }
}

/**
 * 启动时执行 startupCommands，然后进入 prompt 循环
 */
async function boot(): Promise<void> {
    const startups = config.startupCommands.map((cmd) => cmd.trim()).filter((cmd) => cmd.length > 0)

    try {
        for (const cmd of startups) await shell.run(cmd)
    } catch (error) {
        term.println(red(error instanceof Error ? error.message : String(error)))
    }

    await loop()
}

term.onTab(handleTab)
app.addEventListener('click', () => term.focus())

term.println(config.startupMessage)
term.println()
term.focus()

void boot()
