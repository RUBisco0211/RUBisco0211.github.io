/**
 * localStorage 访问的唯一入口。
 *
 * 所有 key 都带 `tty.blog:` 前缀 —— 同源下可能还跑着别的站点/工具，
 * 裸 key（比如 `theme`、`history`）迟早会撞车。
 */

const STORAGE_PREFIX = 'tty.blog:'

function storageKey(name: string): string {
    return `${STORAGE_PREFIX}${name}`
}

/** 隐私模式 / 禁用存储时 localStorage 会抛异常，全部吞掉 */
function store(): Storage | undefined {
    try {
        return typeof localStorage === 'undefined' ? undefined : localStorage
    } catch {
        return undefined
    }
}

export function readStored(name: string): string | null {
    try {
        return store()?.getItem(storageKey(name)) ?? null
    } catch {
        return null
    }
}

export function writeStored(name: string, value: string): void {
    try {
        store()?.setItem(storageKey(name), value)
    } catch {
        // 存不了就算了，不影响使用
    }
}

/** 迁移用：读一个旧的无前缀 key，读到就删掉 */ export function takeLegacy(
    legacyKey: string,
): string | null {
    try {
        const legacy = store()
        const value = legacy?.getItem(legacyKey) ?? null
        if (value !== null) legacy?.removeItem(legacyKey)
        return value
    } catch {
        return null
    }
}
