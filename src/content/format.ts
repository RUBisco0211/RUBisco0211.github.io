/** 1786 → '1.8k'，832 → '832'，18000 → '18k' */
export function formatCount(count: number): string {
    if (count <= 0) return '-'
    if (count < 1000) return String(count)
    const k = count / 1000
    // 9.95 以上 toFixed(1) 会进位成 '10.0k'，这种时候直接取整，避免出现 "10.0k"
    if (k < 10) {
        const one = k.toFixed(1)
        return one === '10.0' ? '10k' : `${one}k`
    }
    return `${Math.round(k)}k`
}

/** 45403 → '4.5 万字'，812 → '812 字' */
export function formatChars(count: number): string {
    if (count < 10000) return `${count} 字`
    const w = count / 10000
    if (w < 10) {
        const one = w.toFixed(1)
        return one === '10.0' ? '10 万字' : `${one} 万字`
    }
    return `${Math.round(w)} 万字`
}
