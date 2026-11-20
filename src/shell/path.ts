/**
 * 路径运算。全部是纯函数，不认识 fs，也不认识命令。
 *
 * 约定：内部一律用绝对路径（'/' 开头，不带结尾斜杠），
 * 只在显示给用户时用 displayPath() 转成 '~/blog' 这种形式。
 */

const ROOT = '/'

function isAbsolute(path: string): boolean {
    return path.startsWith('/')
}

/** 折叠多余的斜杠，处理 '.' 和 '..'，结果不带结尾斜杠（根除外） */
export function normalize(path: string): string {
    const out: string[] = []
    for (const seg of path.split('/')) {
        if (seg === '' || seg === '.') continue
        if (seg === '..') {
            out.pop()
            continue
        }
        out.push(seg)
    }
    return `${ROOT}${out.join('/')}`
}

/** 把用户输入解析成绝对路径。空串和 '~' 都是根。 */
export function resolvePath(cwd: string, arg: string): string {
    const raw = arg.trim()
    if (raw === '' || raw === '~') return ROOT
    if (raw === '.') return normalize(cwd)
    if (raw.startsWith('~/')) return normalize(raw.slice(1))
    if (isAbsolute(raw)) return normalize(raw)
    return normalize(`${cwd}/${raw}`)
}

/** '/' → '~'，'/blog/2026' → '~/blog/2026' */
export function displayPath(abs: string): string {
    const path = normalize(abs)
    return path === ROOT ? '~' : `~${path}`
}

/** '/blog/2026/hello' → { dir: '/blog/2026', base: 'hello' } */
export function splitPath(abs: string): { dir: string; base: string } {
    const path = normalize(abs)
    if (path === ROOT) return { dir: ROOT, base: '' }
    const cut = path.lastIndexOf('/')
    return {
        dir: cut === 0 ? ROOT : path.slice(0, cut),
        base: path.slice(cut + 1),
    }
}
