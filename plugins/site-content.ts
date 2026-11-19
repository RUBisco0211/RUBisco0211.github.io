import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import type { Plugin } from 'vite'
import { CONTENT_DIR, TEXT_URL_PREFIX, readContent } from '../scripts/build-content.ts'

const MODULE_ID = 'virtual:site-tree'
const RESOLVED_ID = `\0${MODULE_ID}`

/**
 * 把 content/ 编译成 `virtual:site-tree`，并在 dev 下把原始 .md 当静态文件吐出去。
 *
 * 元数据走虚拟模块（首屏就要用，内联进 bundle）；正文走 /content/<path> 的
 * fetch，dev 由这里的中间件直接读磁盘，build 后由 prerender 原样拷贝。
 * 源码树和 dist 里都不存在"另一份内容"。
 */
export function siteContent(): Plugin {
    let content = readContent()

    return {
        name: 'tty:site-content',

        buildStart() {
            content = readContent()
            this.info(`content: ${content.docs.length} doc(s)`)
        },

        resolveId(id) {
            if (id === MODULE_ID) return RESOLVED_ID
        },

        load(id) {
            if (id !== RESOLVED_ID) return
            return `export const siteTree = ${JSON.stringify({ docs: content.docs })}`
        },

        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const path = (req.url ?? '').split('?')[0] ?? ''
                if (!path.startsWith(TEXT_URL_PREFIX)) return next()

                let target: string
                try {
                    target = resolve(
                        CONTENT_DIR,
                        decodeURIComponent(path.slice(TEXT_URL_PREFIX.length)),
                    )
                } catch {
                    res.statusCode = 400
                    res.end('bad path')
                    return
                }

                // 只放行 content/ 目录内的 markdown，挡住 ../ 穿越和其它文件
                if (!target.startsWith(CONTENT_DIR + sep) || !/\.mdx?$/.test(target)) {
                    res.statusCode = 404
                    res.end('not found')
                    return
                }

                try {
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
                    res.end(readFileSync(target))
                } catch {
                    res.statusCode = 404
                    res.end('not found')
                }
            })

            const onChange = (file: string) => {
                if (!file.startsWith(CONTENT_DIR)) return
                try {
                    content = readContent()
                    server.config.logger.info('content rebuilt', { timestamp: true })
                    server.ws.send({ type: 'full-reload' })
                } catch (error) {
                    server.config.logger.error(`content rebuild failed: ${String(error)}`)
                }
            }
            server.watcher.on('change', onChange)
            server.watcher.on('add', onChange)
            server.watcher.on('unlink', onChange)
        },
    }
}
