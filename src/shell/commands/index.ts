import type { Command } from '../types.ts'

/**
 * 自动注册：本目录下除了 index.ts 的所有模块，若默认导出一个 Command 就收进来。
 *
 * `reader.ts` 这种命令支撑件没有默认导出，会被下面的 filter 自然跳过，
 * 所以「丢一个文件进 commands/，别处零改动」依然成立。
 */
const modules = import.meta.glob<{ default?: Command }>(['./*.ts', '!./index.ts'], {
    eager: true,
})

export const commands: readonly Command[] = Object.values(modules)
    .map((module) => module.default)
    .filter((command): command is Command => command !== undefined)
