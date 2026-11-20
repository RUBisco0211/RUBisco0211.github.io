/**
 * 动作 → 键位。
 *
 * 键位默认取 `KeyboardEvent.key` 的值；带修饰键的组合写成 chord：
 * `ctrl+c`、`meta+c`（mac 的 ⌘）、`ctrl+shift+c`，键名小写、修饰键顺序固定。
 * Shift+字母 这类修饰本身已经体现在 `event.key` 里（`G` 和 `g` 不同），
 * 所以只有功能键才需要显式写 `shift+`。
 */
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

/** 修饰键按固定顺序拼接，保证 `ctrl+shift+c` 这类写法唯一 */
const MODIFIERS = ['ctrl', 'alt', 'shift', 'meta'] as const

/**
 * 把键盘事件归一化成键位串。
 *
 * 没有修饰键时就是 `event.key` 本身；有修饰键时拼成 `ctrl+shift+c` 这类 chord。
 * 注意 `event.key` 已经区分大小写（`G` / `g`），所以 Shift+字母 不算修饰，
 * 只有 Shift+功能键（`shift+arrowdown`）才进 chord。
 */
export function keyChord(event: KeyboardEvent): string {
    const pressed = MODIFIERS.filter((mod) => {
        if (mod === 'ctrl') return event.ctrlKey
        if (mod === 'alt') return event.altKey
        if (mod === 'shift') return event.shiftKey
        return event.metaKey
    })

    // 字母键的 Shift 是大小写语义，不当作修饰
    const shiftOnlyLetter = pressed.length === 1 && pressed[0] === 'shift' && event.key.length === 1
    if (pressed.length === 0 || shiftOnlyLetter) return event.key

    return [...pressed, event.key.toLowerCase()].join('+')
}

/**
 * 按键找动作：先按 chord 匹配（⌘C / Ctrl+Shift+C），再退回 `event.key` 本身。
 *
 * 两级查找是必要的：`G` 这种大写字母键的修饰语在 `event.key` 里，
 * 而 ⌘C 的 `event.key` 只是 `c`，修饰语只能从 chord 里看。
 */
export function lookupKey<A extends string>(
    map: ReadonlyMap<string, A>,
    event: KeyboardEvent,
): A | undefined {
    const chord = keyChord(event)
    if (chord !== event.key) {
        const action = map.get(chord)
        if (action !== undefined) return action
    }

    return map.get(event.key)
}
