// 数据模型和统计（跟安卓版 Model.kt 一样的算法）

export const STORE_NAME = '11区 Faidherbe'

/** 记一笔单位可选的常用单位 */
export const DEFAULT_UNITS = ['箱', '袋', '包', '桶', '打', '公斤', '斤', '个', '件', '把']
/** 统计、表格里单位的顺序 */
export const UNIT_ORDER = ['箱', '袋', '包', '桶', '打', '公斤', '斤', '个', '根', '件', '把']
export const BOX = '箱'

/** 一条记录。date 是 YYYY-MM-DD。qty 总是正数；taken = 减掉的（负数），party = 原因 */
export interface Rec {
  id?: number
  date: string
  category: string
  name: string
  qty: number
  unit: string
  note: string
  /** 每箱称重（牛肉）：qty 是这一箱的斤数，算 1 箱 */
  weigh: boolean
  /** 减掉的（比如别的店拿走了），统计时减掉 */
  taken: boolean
  /** 减掉的原因 */
  party: string
  created?: number
}

/** 清单里的一样东西 */
export interface Item {
  id?: number
  category: string
  section: string
  name: string
  unit: string
  hint: string
  weigh: boolean
  sort: number
}

/** 一个本子（品类） */
export interface Cat {
  id?: number
  name: string
  /** ARGB，比如 0xFF2F7D95 */
  color: number
  icon: string
  sort: number
}

export function newRec(p: Partial<Rec> & Pick<Rec, 'date' | 'category' | 'name' | 'qty' | 'unit'>): Rec {
  return { note: '', weigh: false, taken: false, party: '', ...p }
}

// ---------- 数字 ----------

/** 5 -> "5"，2.50 -> "2.5"，21.235 -> "21.235"。最多三位小数（四舍五入）。 */
export function fmtQty(d: number): string {
  if (!isFinite(d)) return '0'
  const r = Math.round((d + Math.sign(d) * 1e-9) * 1000) / 1000
  if (r === 0) return '0'
  let s = r.toFixed(3)
  s = s.replace(/\.?0+$/, '')
  return s
}

/** 中文/法语键盘都可能打出逗号，统一当小数点。不是数字返回 null。 */
export function parseQty(s: string): number | null {
  const t = s.trim().replace(/，/g, '.').replace(/,/g, '.')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null
  const n = Number(t)
  return isFinite(n) ? n : null
}

/** 这条记录算几个“数量”：称重的算 1 箱，其它就是填的数。减掉的算负数。 */
export function recCount(r: Rec): number {
  return (r.weigh ? 1 : r.qty) * (r.taken ? -1 : 1)
}

export function sortUnits(units: Iterable<string>): string[] {
  const list = [...new Set(units)]
  const idx = (u: string) => {
    const i = UNIT_ORDER.indexOf(u)
    return i < 0 ? 99 : i
  }
  return list.sort((a, b) => idx(a) - idx(b) || a.localeCompare(b))
}

// ---------- 日期（都用本地日期，YYYY-MM-DD） ----------

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function today(): string {
  return toISO(new Date())
}
export function addDays(s: string, n: number): string {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export function addMonths(s: string, n: number): string {
  const d = fromISO(s)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toISO(d)
}
export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000)
}
/** 1 = 周一 … 7 = 周日 */
export function dayOfWeek(s: string): number {
  const w = fromISO(s).getDay()
  return w === 0 ? 7 : w
}
export function monday(s: string): string {
  return addDays(s, 1 - dayOfWeek(s))
}
export function firstOfMonth(s: string): string {
  return s.slice(0, 8) + '01'
}
export function lastOfMonth(s: string): string {
  const d = fromISO(s)
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}
export function minDate(a: string, b: string) {
  return a < b ? a : b
}
export function maxDate(a: string, b: string) {
  return a > b ? a : b
}

const WEEK = ['一', '二', '三', '四', '五', '六', '日']
export const weekShort = (s: string) => '周' + WEEK[dayOfWeek(s) - 1]
export const weekFull = (s: string) => '星期' + WEEK[dayOfWeek(s) - 1]
export function shortDate(s: string) {
  const d = fromISO(s)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
export const shortDateWeek = (s: string) => `${shortDate(s)} ${weekShort(s)}`
export function fullDate(s: string) {
  const d = fromISO(s)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekFull(s)}`
}
export function relativeDay(s: string, t = today()): string {
  if (s === t) return '今天'
  if (s === addDays(t, -1)) return '昨天'
  if (s === addDays(t, -2)) return '前天'
  return ''
}
export function rangeLabel(from: string | null, to: string | null): string {
  if (!from && !to) return '全部日期'
  if (from && from === to) return `${from}（${weekFull(from)}）`
  return `${from ?? '最早'} 至 ${to ?? '现在'}`
}

export type RangeKind = 'TODAY' | 'WEEK' | 'MONTH' | 'LAST_MONTH' | 'ALL'
export const RANGE_LABEL: Record<RangeKind, string> = {
  TODAY: '今天',
  WEEK: '本周',
  MONTH: '本月',
  LAST_MONTH: '上月',
  ALL: '全部',
}
export function rangeOf(kind: RangeKind, t = today()): [string | null, string | null] {
  switch (kind) {
    case 'TODAY':
      return [t, t]
    case 'WEEK':
      return [monday(t), addDays(monday(t), 6)]
    case 'MONTH':
      return [firstOfMonth(t), lastOfMonth(t)]
    case 'LAST_MONTH': {
      const p = addMonths(firstOfMonth(t), -1)
      return [p, lastOfMonth(p)]
    }
    case 'ALL':
      return [null, null]
  }
}

// ---------- 统计 ----------

export function orderKey(category: string, name: string) {
  return `${category}\u0001${name}`
}
/** 清单顺序：统计和表格按纸上的顺序排 */
export function itemOrder(items: Item[]): Map<string, number> {
  return new Map(items.map((it) => [orderKey(it.category, it.name), it.sort]))
}

function addTo(m: Map<string, number>, r: Rec) {
  if (r.weigh) m.set(BOX, (m.get(BOX) ?? 0) + 1)
  m.set(r.unit, (m.get(r.unit) ?? 0) + r.qty)
}
function unitsText(m: Map<string, number>): string {
  return sortUnits(m.keys())
    .map((u) => fmtQty(m.get(u)!) + u)
    .join(' ')
}

/** 某个品名（在某个本子里）的合计。byUnit 是实际的（进的减去减掉的）。 */
export class ItemSum {
  inByUnit = new Map<string, number>()
  outByUnit = new Map<string, number>()
  total = 0
  /** 进了几笔（不算减掉的） */
  count = 0
  takenCount = 0
  weighed = false
  constructor(public category: string, public name: string) {}

  add(r: Rec) {
    if (r.taken) {
      addTo(this.outByUnit, r)
      this.takenCount++
    } else {
      addTo(this.inByUnit, r)
      this.count++
    }
    this.total += recCount(r)
    if (r.weigh) this.weighed = true
  }
  get hasTaken() {
    return this.takenCount > 0
  }
  get byUnit(): Map<string, number> {
    const m = new Map<string, number>()
    for (const u of sortUnits([...this.inByUnit.keys(), ...this.outByUnit.keys()])) {
      m.set(u, (this.inByUnit.get(u) ?? 0) - (this.outByUnit.get(u) ?? 0))
    }
    return m
  }
  /** 实际的，例如 "5箱 2袋" */
  unitsText() {
    return unitsText(this.byUnit)
  }
  inText() {
    return unitsText(this.inByUnit)
  }
  outText() {
    return unitsText(this.outByUnit)
  }
  /** “3箱（进5箱，减掉2箱）” */
  fullText() {
    if (!this.hasTaken || this.count === 0) return this.unitsText()
    return `${this.unitsText()}（进${this.inText()}，减掉${this.outText()}）`
  }
  /** 表格里：两行 */
  twoLines(): [string, string | null] {
    if (!this.hasTaken || this.count === 0) return [this.unitsText(), null]
    return [this.unitsText(), `进${this.inText()} · 减掉${this.outText()}`]
  }
}

export function unitTotals(records: Rec[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of records) {
    const sign = r.taken ? -1 : 1
    if (r.weigh) m.set(BOX, (m.get(BOX) ?? 0) + sign)
    m.set(r.unit, (m.get(r.unit) ?? 0) + sign * r.qty)
  }
  const out = new Map<string, number>()
  for (const u of sortUnits(m.keys())) out.set(u, m.get(u)!)
  return out
}

export function unitsLine(m: Map<string, number>): string {
  return [...m.entries()].map(([u, v]) => fmtQty(v) + u).join(' · ')
}

export function itemSums(records: Rec[], order: Map<string, number> = new Map(), catIndex: (c: string) => number = () => 0): ItemSum[] {
  const map = new Map<string, ItemSum>()
  for (const r of records) {
    const k = orderKey(r.category, r.name)
    let s = map.get(k)
    if (!s) map.set(k, (s = new ItemSum(r.category, r.name)))
    s.add(r)
  }
  return [...map.values()].sort(
    (a, b) =>
      catIndex(a.category) - catIndex(b.category) ||
      (order.get(orderKey(a.category, a.name)) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(orderKey(b.category, b.name)) ?? Number.MAX_SAFE_INTEGER) ||
      b.count - a.count ||
      a.name.localeCompare(b.name),
  )
}

export interface DaySum {
  date: string
  records: Rec[]
  items: ItemSum[]
}
export function daySums(records: Rec[], descending = true, order = new Map<string, number>(), catIndex: (c: string) => number = () => 0): DaySum[] {
  const g = new Map<string, Rec[]>()
  for (const r of records) {
    const l = g.get(r.date)
    if (l) l.push(r)
    else g.set(r.date, [r])
  }
  const keys = [...g.keys()].sort()
  if (descending) keys.reverse()
  return keys.map((d) => ({ date: d, records: g.get(d)!, items: itemSums(g.get(d)!, order, catIndex) }))
}

/** 一条减掉的写成一句话：“−2箱 · 2号店拿走了” */
export function takenText(r: Rec): string {
  return (
    '−' +
    (r.weigh ? `1箱 ${fmtQty(r.qty)}${r.unit}` : `${fmtQty(r.qty)}${r.unit}`) +
    (r.party.trim() ? ` · ${r.party}` : '') +
    (r.note.trim() ? `（${r.note}）` : '')
  )
}

/** ARGB 整数 → CSS 颜色 */
export function cssColor(argb: number): string {
  const n = argb >>> 0
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0')
}
