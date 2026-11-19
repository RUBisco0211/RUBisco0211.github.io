/**
 * 把正文拷进 dist/content/，路径和 content/ 里完全一致。
 *
 * 终端运行时要 fetch /content/<path>，所以这一步必须保留。
 * 只拷 markdown —— 同目录的图片之类目前没有任何地方引用，不往 dist 里搬。
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { CONTENT_DIR, readContent } from './build-content.ts'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')

if (!existsSync(DIST)) {
    console.error('dist/ 不存在，先跑 vite build')
    process.exit(1)
}

const { docs } = readContent()

for (const doc of docs) {
    const to = join(DIST, 'content', doc.path)
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(join(CONTENT_DIR, doc.path), to)
}

console.log(`content: ${docs.length} file(s) → dist/content/`)
