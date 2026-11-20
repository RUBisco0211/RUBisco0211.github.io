/**
 * 测试用的内存版 Storage，替代 jsdom。
 *
 * storage.ts 和 SiteHistory 都直接读 `globalThis.localStorage`，
 * 所以在 node 里跑测试必须把它换掉。所有用到它的测试都从这里拿，
 * 避免每个文件重复写一份 20 行的实现。
 */

export function fakeStorage(): Storage {
    const map = new Map<string, string>()
    return {
        get length() {
            return map.size
        },
        clear: () => map.clear(),
        getItem: (key: string) => map.get(key) ?? null,
        key: (index: number) => [...map.keys()][index] ?? null,
        removeItem: (key: string) => void map.delete(key),
        setItem: (key: string, value: string) => void map.set(key, value),
    } as Storage
}

/**
 * 装一个假 localStorage 到 globalThis，返回它和恢复函数。
 * 测试里在 beforeEach 装、afterEach 恢复。
 */
export function installFakeStorage(): { storage: Storage; restore: () => void } {
    const original = (globalThis as { localStorage?: Storage }).localStorage
    const storage = fakeStorage()
    ;(globalThis as { localStorage?: Storage }).localStorage = storage
    return {
        storage,
        restore: () => {
            ;(globalThis as { localStorage?: Storage }).localStorage = original
        },
    }
}
