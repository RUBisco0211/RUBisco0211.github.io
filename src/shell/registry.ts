import type { Command } from './types.ts'

export interface Registry {
  get(name: string): Command | undefined
  /** 按名字排序，help 和 Tab 补全都用这个顺序 */
  list(): readonly Command[]
  names(): readonly string[]
}

export function createRegistry(commands: readonly Command[]): Registry {
  const map = new Map<string, Command>()

  for (const command of commands) {
    if (map.has(command.name)) throw new Error(`命令名重复：${command.name}`)
    map.set(command.name, command)
  }

  const sorted = [...map.values()].sort((a, b) => a.name.localeCompare(b.name))

  return {
    get: (name) => map.get(name),
    list: () => sorted,
    names: () => sorted.map((command) => command.name),
  }
}
