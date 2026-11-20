import type { Command } from '../types.ts'

/**
 * 自动注册：本目录下除了 index.ts 的所有模块，必须默认导出一个 Command 对象
 */
const modules = import.meta.glob<{ default?: Command }>(['./*.ts', '!./index.ts'], {
    eager: true,
})

export const commands: readonly Command[] = Object.values(modules)
    .map((module) => module.default)
    .filter((command): command is Command => command !== undefined)
