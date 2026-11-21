import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { siteContent } from './plugins/site-content.ts'

export default defineConfig({
    plugins: [siteContent()],
    server: { host: true },
    resolve: {
        alias: {
            // 用 '@/ 而不是 '@'：避免把 @xterm/xterm 这类 scoped 包也前缀匹配掉
            '@/': fileURLToPath(new URL('./src/', import.meta.url)),
        },
    },
    test: {
        include: ['tests/**/*.test.{ts,mjs}'],
    },
})
