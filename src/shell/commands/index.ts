import type { Command } from '../types.ts'

/**
 * 自动注册：丢一个文件进本目录、默认导出一个 Command，就多一条命令。
 * 排除 index.ts 自己。
 *
 * 过滤掉没有默认导出的模块 —— 否则在这个目录里放一个辅助文件
 * （比如以前放这儿的 neofetch-art.ts）会被当成命令收进去，
 * registry 拿到 undefined 直接崩。
 */
const modules = import.meta.glob<{ default?: Command }>(['./*.ts', '!./index.ts'], {
  eager: true,
})

export const commands: readonly Command[] = Object.values(modules)
  .map((module) => module.default)
  .filter((command): command is Command => command !== undefined)
