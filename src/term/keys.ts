/** 动作 → 键位。键位取 `KeyboardEvent.key` 的值 */
export type Keymap<A extends string> = Readonly<Record<A, readonly string[]>>

/**
 * 合并默认键位和调用方覆盖。
 *
 * - 覆盖按动作替换，不是追加（要追加就自己把默认值展开）
 * - 同一个键落到两个动作直接抛错，避免静默 last-wins
 */
export function resolveKeys<A extends string>(
    defaults: Keymap<A>,
    overrides: Partial<Keymap<A>> = {},
): Map<string, A> {
    const map = new Map<string, A>()

    for (const action of Object.keys(defaults) as A[]) {
        for (const key of overrides[action] ?? defaults[action]) {
            const previous = map.get(key)
            if (previous !== undefined && previous !== action) {
                throw new Error(`按键冲突：${key} 同时绑定 ${previous} 和 ${action}`)
            }
            map.set(key, action)
        }
    }

    return map
}
