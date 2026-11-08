// 拍照识别：提示词、读 AI 的回答、把品名对到清单上。跟安卓版 Recognize.kt 一样。
import type { Item } from '../data/model'
import { parseQty } from '../data/model'
import { AiError } from './deepseek'
import { parseDate } from './report'

export interface Other {
  name: string
  qty: number
  unit: string
}
export interface WeighRaw {
  name: string
  values: number[]
  sure: boolean
  paperCount: number | null
  paperTotal: number | null
}
export interface Raw {
  date: string | null
  counts: { name: string; qty: number; sure: boolean }[]
  weights: WeighRaw[]
  others: Other[]
}
export interface CountLine {
  item: Item
  qty: number
  sure: boolean
}
export interface WeighLine {
  item: Item
  values: number[]
  sure: boolean
  paperCount: number | null
  paperTotal: number | null
}
export interface Result {
  date: string | null
  counts: CountLine[]
  weights: WeighLine[]
  others: Other[]
}

export function systemPrompt(category: string, items: Item[], todayISO: string): string {
  const year = todayISO.slice(0, 4)
  const lines = [
    '你是餐馆进货单的识别助手。用户会发一张进货单的照片，你要读出每样东西旁边手写的数量。',
    '',
    `这张单子是「${category}」。清单如下（品名｜单位｜分区｜填法）：`,
    ...items.map((it) => `${it.name}｜${it.unit}｜${it.section || '-'}｜${it.weigh ? '每箱称重' : '数量'}`),
    '',
    '规则：',
    '1. 品名可能是印好的，也可能是手写的；数量是手写的数字，写在品名右边同一行的格子里。',
    '2. 一张纸上可能有好几栏并排（每栏都是“品名｜数量”），数字只属于同一行、紧挨在它左边的那个品名，不要串到别的栏。',
    '3. 品名后面括号里的是单位或规格（比如“小袋 (箱)”“土豆(25kg)”），不是数量。',
    '4. 格子是空的就不要返回这一样。数字被划掉改写的，以改写后的为准。',
    '5. “每箱称重”的东西，纸上写了好几个数，每个数是一箱的重量，按顺序全部列出来，小数照纸上写的原样（比如 21.235 不要写成 21.24）。',
    '   这些数可能分成好几列写：先左边一列从上到下，再右边一列从上到下。',
    '   “共15箱”“共308.03kg”“合计”这种是合计，不是一箱：箱数写进 paper_count，总重量写进 paper_total；纸上没写就是 null。',
    '6. name 必须用上面清单里的写法。纸上有、清单里没有的，放到 others，并写上单位（看不出单位就写空字符串）。',
    '7. 看不太清、拿不准的，sure 写 false。',
    `8. 纸上如果写了日期，date 写成 YYYY-MM-DD（年份看不出来就用 ${year}）；没写日期就是 null。`,
    '',
    '只输出一个 JSON，不要任何别的文字，格式：',
  ]
  return (
    lines.join('\n') +
    '\n' +
    '{"date": null, "items": [{"name": "品名", "qty": 3, "sure": true}], ' +
    '"weights": [{"name": "品名", "values": [20.92, 21.235], "sure": true, "paper_count": 15, "paper_total": 308.03}], ' +
    '"others": [{"name": "品名", "qty": 2, "unit": "袋"}]}'
  )
}

export const USER_TEXT = '请按规则读出这张单子上的数字，只回 JSON。'

function num(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null
  if (typeof v === 'string') return parseQty(v.replace(/[^0-9.,，]/g, ''))
  return null
}
const sureOf = (v: unknown) => !(v === false || v === 'false')
const strOf = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

/** 从 AI 的回答里取出 JSON（可能包在 ``` 里，或前后有别的字）。 */
export function parse(answer: string): Raw {
  const start = answer.indexOf('{')
  const end = answer.lastIndexOf('}')
  if (start < 0 || end <= start) throw new AiError('AI 没有按格式回答，请再拍一次试试')
  let o: Record<string, unknown>
  try {
    o = JSON.parse(answer.slice(start, end + 1))
  } catch {
    throw new AiError('AI 的回答格式不对，请再拍一次试试')
  }
  const arr = (name: string): Record<string, unknown>[] => {
    const a = o[name]
    return Array.isArray(a) ? a.filter((x) => x && typeof x === 'object' && !Array.isArray(x)) : []
  }
  const d = typeof o.date === 'string' && o.date.trim() && o.date !== 'null' ? parseDate(o.date.trim()) : null
  const counts = arr('items').flatMap((j) => {
    const n = strOf(j.name)
    const q = num(j.qty)
    return !n || q == null || q <= 0 ? [] : [{ name: n, qty: q, sure: sureOf(j.sure) }]
  })
  const weights = arr('weights').flatMap((j) => {
    const n = strOf(j.name)
    const vs = (Array.isArray(j.values) ? j.values : []).map(num).filter((v): v is number => v != null && v > 0)
    const pcN = num(j.paper_count)
    const ptN = num(j.paper_total)
    return !n || !vs.length
      ? []
      : [{ name: n, values: vs, sure: sureOf(j.sure), paperCount: pcN != null && pcN > 0 ? Math.trunc(pcN) : null, paperTotal: ptN != null && ptN > 0 ? ptN : null }]
  })
  const others = arr('others').flatMap((j) => {
    const n = strOf(j.name)
    const q = num(j.qty)
    return !n || q == null || q <= 0 ? [] : [{ name: n, qty: q, unit: strOf(j.unit) }]
  })
  return { date: d, counts, weights, others }
}

/** 统一写法：去空格、全角变半角、英文不分大小写。 */
export function norm(s: string): string {
  let out = ''
  for (const ch of s.trim()) {
    const code = ch.charCodeAt(0)
    let c = ch
    if (code >= 0xff01 && code <= 0xff5e) c = String.fromCharCode(code - 0xfee0)
    else if (ch === '　') c = ' '
    if (!/\s/.test(c)) out += c.toLowerCase()
  }
  return out
}

const noParen = (s: string) => s.replace(/\(.*?\)/g, '')
const single = <T>(l: T[]) => (l.length === 1 ? l[0] : null)

/** 在清单里找 AI 说的那一样；找不到（或对上好几样分不清）返回 null。 */
export function find(items: Item[], name: string): Item | null {
  const n = norm(name)
  const exact = items.find((it) => norm(it.name) === n)
  if (exact) return exact
  // AI 没写括号，清单里去掉括号后只有一样对得上（土豆有 25kg 和 10kg 两样时就不算）
  if (!n.includes('(')) {
    const m = single(items.filter((it) => noParen(norm(it.name)) === n))
    if (m) return m
  }
  // AI 多写了括号，清单里没有
  const bare = noParen(n)
  if (bare !== n) {
    const m = single(items.filter((it) => norm(it.name) === bare))
    if (m) return m
  }
  // 互相包含（“锡纸” ↔ “锡纸 30CM”），也只在唯一时才算
  if (n.length >= 2) {
    const m = single(
      items.filter((it) => {
        const x = norm(it.name)
        return x.length >= 2 && (x.includes(n) || n.includes(x))
      }),
    )
    if (m) return m
  }
  return null
}

export function match(items: Item[], raw: Raw): Result {
  const keyOf = (it: Item) => it.id ?? `${it.category}\u0001${it.name}`
  const counts = new Map<number | string, CountLine>()
  const weights = new Map<number | string, WeighLine>()
  const others: Other[] = []
  for (const { name, qty, sure } of raw.counts) {
    const it = find(items, name)
    if (!it) others.push({ name, qty, unit: '' })
    else if (it.weigh) {
      const old = weights.get(keyOf(it))
      weights.set(keyOf(it), { item: it, values: [...(old?.values ?? []), qty], sure: sure && !old, paperCount: old?.paperCount ?? null, paperTotal: old?.paperTotal ?? null })
    } else {
      // 同一样出现两次：加起来，标成没把握
      const old = counts.get(keyOf(it))
      counts.set(keyOf(it), old ? { item: it, qty: old.qty + qty, sure: false } : { item: it, qty, sure })
    }
  }
  for (const w of raw.weights) {
    const it = find(items, w.name)
    if (!it) w.values.forEach((v) => others.push({ name: w.name, qty: v, unit: '斤' }))
    else if (it.weigh) {
      const old = weights.get(keyOf(it))
      weights.set(
        keyOf(it),
        old
          ? { item: it, values: [...old.values, ...w.values], sure: false, paperCount: old.paperCount ?? w.paperCount, paperTotal: old.paperTotal ?? w.paperTotal }
          : { item: it, values: [...w.values], sure: w.sure, paperCount: w.paperCount, paperTotal: w.paperTotal },
      )
    } else counts.set(keyOf(it), { item: it, qty: w.values.reduce((a, b) => a + b, 0), sure: false })
  }
  for (const o of raw.others) {
    const it = find(items, o.name)
    if (it && !it.weigh && !counts.has(keyOf(it))) counts.set(keyOf(it), { item: it, qty: o.qty, sure: false })
    else others.push(o)
  }
  const order = new Map(items.map((it, i) => [keyOf(it), i]))
  const pos = (it: Item) => order.get(keyOf(it)) ?? Number.MAX_SAFE_INTEGER
  return {
    date: raw.date,
    counts: [...counts.values()].sort((a, b) => pos(a.item) - pos(b.item)),
    weights: [...weights.values()].sort((a, b) => pos(a.item) - pos(b.item)),
    others,
  }
}
