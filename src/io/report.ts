// 生成发给老板的 Excel / 备份文件，以及从表格导入。格式跟安卓版 Report.kt 完全一样，两边的备份可以互相恢复。
import type { Cat, Item, Rec } from '../data/model'
import {
  BOX,
  STORE_NAME,
  daySums,
  fmtQty,
  fromISO,
  itemOrder,
  itemSums,
  rangeLabel,
  takenText,
  toISO,
  unitTotals,
  weekFull,
  weekShort,
} from '../data/model'
import { CAT_COLORS, CAT_ICONS } from '../data/seeds'
import { CELL, HEADER, PLAIN, TITLE, TOTAL, XlsxWriter, num, str, type Cell, type ReadSheet, type Sheet } from './xlsx'

export const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const LIST_SHEET = '清单'
export const CAT_SHEET = '本子'
/** 备份里的 App 设置（拍照识别的 Key 等）。只在备份文件里有，发老板的表格里没有。 */
export const SETTINGS_SHEET = '设置'
export const TAKEN_SHEET = '减掉的'
export const CAT_HEADER = ['本子', '颜色', '图标']
export const LIST_HEADER = ['本子', '分区', '品名', '单位', '填法', '提示']
export const COUNT_MODE = '填数量'
export const WEIGH_MODE = '每箱称重'

export const backupName = (today: string) => `餐馆记账备份_${today}.xlsx`
/** 只备份一段时间的记录（本子、清单、设置还是全部带上） */
export const backupRangeName = (from: string, to: string) => `餐馆记账备份_${from}至${to}.xlsx`
export const listsName = (today: string) => `餐馆记账清单_${today}.xlsx`

export function fileName(from: string | null, to: string | null, category: string | null, today: string): string {
  const c = category ?? '全部'
  const r = !from && !to ? `全部日期_截至${today}` : from === to ? from! : `${from ?? '最早'}至${to ?? today}`
  return `餐馆记账_${c}_${r}.xlsx`
}

/** ARGB → "#FF2F7D95" */
export const colorHex = (argb: number) => '#' + (argb >>> 0).toString(16).toUpperCase().padStart(8, '0')

function nowText(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${toISO(d)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const md = (iso: string) => {
  const d = fromISO(iso)
  return [d.getMonth() + 1, d.getDate()]
}

function catIndexOf(cats: Cat[]) {
  const m = new Map(cats.map((c, i) => [c.name, i]))
  return (n: string) => m.get(n) ?? 999
}

function catSheet(x: XlsxWriter, cats: Cat[]) {
  const s = x.sheet(CAT_SHEET)
  s.rowOf(CAT_HEADER.map((h) => str(h, HEADER)))
  s.freezeRows = 1
  for (const c of cats) s.row(str(c.name), str(colorHex(c.color)), str(c.icon))
  s.widths = [12, 12, 10]
}

function listSheet(x: XlsxWriter, items: Item[], cats: Cat[]) {
  const ci = catIndexOf(cats)
  const s = x.sheet(LIST_SHEET)
  s.rowOf(LIST_HEADER.map((h) => str(h, HEADER)))
  s.freezeRows = 1
  ;[...items]
    .sort((a, b) => ci(a.category) - ci(b.category) || a.sort - b.sort)
    .forEach((it) => s.row(str(it.category), str(it.section), str(it.name), str(it.unit), str(it.weigh ? WEIGH_MODE : COUNT_MODE), str(it.hint)))
  s.widths = [8, 12, 18, 8, 10, 20]
}

/** 只有清单（设置），没有记录：发到别的手机，大家用一样的清单。 */
export function buildLists(items: Item[], cats: Cat[]): Uint8Array {
  const x = new XlsxWriter()
  listSheet(x, items, cats)
  catSheet(x, cats)
  return x.toBytes()
}

export interface BuildOpts {
  records: Rec[]
  from: string | null
  to: string | null
  category: string | null
  now?: Date
  items?: Item[]
  cats: Cat[]
  withLists?: boolean
  settings?: [string, string][]
}

const amount = (l: Rec[]) => l.reduce((a, r) => a + (r.taken ? -r.qty : r.qty), 0)
const boxes = (l: Rec[]) => l.reduce((a, r) => a + (r.taken ? -1 : 1), 0)

export function build(o: BuildOpts): Uint8Array {
  const items = o.items ?? []
  const cats = o.cats
  const ci = catIndexOf(cats)
  const order = itemOrder(items)
  const sorted = [...o.records].sort((a, b) => a.date.localeCompare(b.date) || ci(a.category) - ci(b.category) || (a.id ?? 0) - (b.id ?? 0))
  const units = [...unitTotals(sorted).keys()]
  const info =
    `时间：${rangeLabel(o.from, o.to)}　类别：${o.category ?? '全部'}　共 ${sorted.length} 条记录　` + `导出：${nowText(o.now ?? new Date())}`
  const x = new XlsxWriter()

  // ---- 汇总 ----
  const s1 = x.sheet('汇总')
  s1.row(str(`餐馆记账 · 汇总 · ${STORE_NAME}`, TITLE))
  s1.row(str(info, PLAIN))
  s1.row()
  const taken = sorted.filter((r) => r.taken)
  const anyTaken = taken.length > 0
  const reasonsOf = (l: Rec[]) =>
    l
      .filter((r) => r.taken)
      .map((r) => {
        const [m, d] = md(r.date)
        return `${m}/${d} ${takenText(r)}`
      })
      .join('；')
  s1.rowOf([...['类别', '品名'], ...units, '总数', '次数', ...(anyTaken ? ['进货', '减掉', '减掉的原因'] : [])].map((h) => str(h, HEADER)))
  s1.freezeRows = 4
  const sums = itemSums(sorted, order, ci)
  const unitCells = (byUnit: Map<string, number>): Cell[] =>
    units.map((u) => {
      const v = byUnit.get(u)
      return v != null && v !== 0 ? num(v) : str('')
    })
  for (const s of sums) {
    s1.rowOf([
      str(s.category),
      str(s.name),
      ...unitCells(s.byUnit),
      num(s.total),
      num(s.count),
      ...(anyTaken ? [str(s.inText()), str(s.outText()), str(reasonsOf(sorted.filter((r) => r.category === s.category && r.name === s.name)))] : []),
    ])
  }
  // 不同的东西不能加在一起，所以没有“小计 / 合计”行
  if (!sorted.length) s1.row(str('（这段时间没有记录）', PLAIN))
  s1.widths = [8, 18, ...units.map(() => 9), 9, 7, ...(anyTaken ? [12, 12, 40] : [])]

  // ---- 每日 ----
  const s2 = x.sheet('每日')
  s2.rowOf([...['日期', '星期', '类别', '品名'], ...units, '总数', ...(anyTaken ? ['减掉的原因'] : [])].map((h) => str(h, HEADER)))
  s2.freezeRows = 1
  for (const d of daySums(sorted, false, order, ci)) {
    for (const s of d.items) {
      s2.rowOf([
        str(d.date),
        str(weekFull(d.date)),
        str(s.category),
        str(s.name),
        ...unitCells(s.byUnit),
        num(s.total),
        ...(anyTaken
          ? [
              str(
                d.records
                  .filter((r) => r.taken && r.category === s.category && r.name === s.name)
                  .map(takenText)
                  .join('；'),
              ),
            ]
          : []),
      ])
    }
  }
  s2.widths = [12, 8, 10, 18, ...units.map(() => 9), 9, ...(anyTaken ? [30] : [])]

  // ---- 减掉的 ----
  if (anyTaken) {
    const st = x.sheet(TAKEN_SHEET)
    st.rowOf(['日期', '星期', '类别', '品名', '减掉', '单位', '原因', '备注'].map((h) => str(h, HEADER)))
    st.freezeRows = 1
    for (const r of taken) {
      st.row(str(r.date), str(weekFull(r.date)), str(r.category), str(r.weigh ? `${r.name}（1箱）` : r.name), num(r.qty), str(r.unit), str(r.party), str(r.note))
    }
    st.widths = [12, 8, 8, 18, 9, 6, 24, 20]
  }

  // ---- 每个本子一张 ----
  for (const c of o.category == null ? cats.map((c) => c.name) : [o.category]) {
    bookSheet(
      x,
      c,
      items.filter((i) => i.category === c),
      sorted.filter((r) => r.category === c),
      info,
    )
  }

  // ---- 明细（App 导入时读这张表） ----
  const s3 = x.sheet('明细')
  s3.rowOf(['日期', '星期', '类别', '品名', '数量', '单位', '备注', '称重', '减掉', '原因'].map((h) => str(h, HEADER)))
  s3.freezeRows = 1
  for (const r of sorted) {
    s3.row(
      str(r.date),
      str(weekFull(r.date)),
      str(r.category),
      str(r.name),
      num(r.qty),
      str(r.unit),
      str(r.note, CELL),
      str(r.weigh ? '是' : ''),
      str(r.taken ? '是' : ''),
      str(r.party),
    )
  }
  s3.widths = [12, 8, 8, 18, 9, 8, 24, 6, 6, 20]

  // ---- 备份时多几张：清单、本子、设置 ----
  if (o.withLists) {
    listSheet(x, items, cats)
    catSheet(x, cats)
    const settings = o.settings ?? []
    if (settings.length) {
      const st = x.sheet(SETTINGS_SHEET)
      st.row(str('项目', HEADER), str('值', HEADER))
      for (const [k, v] of settings) st.row(str(k), str(v))
      st.widths = [14, 60]
    }
  }
  return x.toBytes()
}

/** 一行一样东西，一列一天，最后一列合计。称重的东西分两行：箱数、斤数。减掉的算负数。 */
function bookSheet(x: XlsxWriter, category: string, items: Item[], recs: Rec[], info: string) {
  const s: Sheet = x.sheet(category)
  const dates = [...new Set(recs.map((r) => r.date))].sort()
  s.row(str(`${category} · ${STORE_NAME}`, TITLE))
  s.row(str(info.split('　共')[0], PLAIN))
  s.row()
  s.rowOf(
    [
      '分区',
      '品名',
      '单位',
      ...dates.map((d) => {
        const [m, day] = md(d)
        return `${m}-${day} ${weekShort(d)}`
      }),
      '合计',
    ].map((h) => str(h, HEADER)),
  )
  s.freezeRows = 4
  s.freezeCols = 2

  const line = (section: string, name: string, unit: string, value: (l: Rec[]) => number, pick: (r: Rec) => boolean, bold = false) => {
    const st = bold ? TOTAL : CELL
    const mine = recs.filter(pick)
    const byDate = new Map<string, Rec[]>()
    for (const r of mine) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r])
    s.rowOf([
      str(section, st),
      str(name, st),
      str(unit, st),
      ...dates.map((d) => {
        const l = byDate.get(d)
        return l ? num(value(l), st) : str('', st)
      }),
      mine.length ? num(value(mine), st) : str('', st),
    ])
  }

  const listed = new Set<string>()
  for (const it of items) {
    if (it.weigh) {
      const pick = (r: Rec) => r.weigh && r.name === it.name && r.unit === it.unit
      line(it.section, `${it.name}（箱数）`, BOX, boxes, pick)
      line(it.section, `${it.name}（${it.unit}数）`, it.unit, amount, pick)
    } else {
      line(it.section, it.name, it.unit, amount, (r) => !r.weigh && r.name === it.name && r.unit === it.unit)
    }
    listed.add(`${it.weigh}|${it.name}|${it.unit}`)
  }
  // 清单里没有、临时加的
  const extra = new Map<string, [string, string, boolean]>()
  for (const r of recs) {
    const k = `${r.weigh}|${r.name}|${r.unit}`
    if (!listed.has(k) && !extra.has(k)) extra.set(k, [r.name, r.unit, r.weigh])
  }
  for (const [name, unit, weigh] of extra.values()) {
    const pick = (r: Rec) => r.name === name && r.unit === unit && r.weigh === weigh
    if (weigh) {
      line('临时', `${name}（箱数）`, BOX, boxes, pick)
      line('临时', `${name}（${unit}数）`, unit, amount, pick)
    } else line('临时', name, unit, amount, pick)
  }
  if (!items.length && !recs.length) s.row(str('（没有记录）', PLAIN))
  s.widths = [10, 18, 6, ...dates.map(() => 10), 9]
}

// ---------------- 导入 ----------------

export interface Parsed {
  records: Rec[]
  bad: number
  items: Item[]
  cats: Cat[]
  settings: Map<string, string>
}
export interface Preview {
  total: number
  fresh: Rec[]
  dup: number
  bad: number
  items: Item[]
  cats: Cat[]
  settings: Map<string, string>
}

const YES = new Set(['是', '1', 'TRUE', 'true', 'Y'])

export function parse(sheets: ReadSheet[]): Parsed {
  type H = { sheet: ReadSheet; row: number; date: number; cat: number; name: number; qty: number; unit: number; note: number; weigh: number; taken: number; reason: number }
  const headers: H[] = []
  for (const s of sheets) {
    for (let i = 0; i < Math.min(8, s.rows.length); i++) {
      const row = s.rows[i]
      const idx = (k: string) => row.findIndex((c) => c.trim() === k)
      const d = idx('日期')
      const n = idx('品名')
      const q = idx('数量')
      if (d >= 0 && n >= 0 && q >= 0) {
        headers.push({ sheet: s, row: i, date: d, cat: idx('类别'), name: n, qty: q, unit: idx('单位'), note: idx('备注'), weigh: idx('称重'), taken: idx('减掉'), reason: idx('原因') })
        break
      }
    }
  }
  const withCat = headers.filter((h) => h.cat >= 0)
  const chosen = withCat.length
    ? [withCat.find((h) => h.sheet.name === '明细') ?? withCat[0]]
    : headers.filter((h) => !['汇总', '每日', LIST_SHEET, CAT_SHEET].includes(h.sheet.name))
  const items = parseLists(sheets)
  const cats = parseCats(sheets)
  const settings = parseSettings(sheets)
  if (!chosen.length) {
    if (items.length || cats.length || settings.size) return { records: [], bad: 0, items, cats, settings }
    throw new Error('表格里没有找到“日期 / 品名 / 数量”这几列')
  }
  let bad = 0
  const out: Rec[] = []
  for (const h of chosen) {
    for (const row of h.sheet.rows.slice(h.row + 1)) {
      if (row.every((c) => !c.trim())) continue
      const cell = (i: number) => (i >= 0 && i < row.length ? row[i].trim() : '')
      const date = parseDate(cell(h.date))
      const name = cell(h.name)
      const qs = cell(h.qty).replace(/,/g, '.')
      const qty = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(qs) ? Number(qs) : null
      const cat = h.cat >= 0 ? cell(h.cat) : h.sheet.name
      const unit = h.unit >= 0 ? cell(h.unit) : ''
      if (!date || !name || qty == null || !(qty > 0) || !cat || !unit) {
        bad++
        continue
      }
      out.push({
        date,
        category: cat,
        name,
        qty,
        unit,
        note: h.note >= 0 ? cell(h.note) : '',
        weigh: h.weigh >= 0 && YES.has(cell(h.weigh)),
        taken: h.taken >= 0 && YES.has(cell(h.taken)),
        party: h.reason >= 0 ? cell(h.reason) : '',
      })
    }
  }
  return { records: out, bad, items, cats, settings }
}

export function parseSettings(sheets: ReadSheet[]): Map<string, string> {
  const m = new Map<string, string>()
  const sheet = sheets.find((s) => s.name === SETTINGS_SHEET)
  if (!sheet) return m
  for (const row of sheet.rows.slice(1)) {
    const k = (row[0] ?? '').trim()
    const v = (row[1] ?? '').trim()
    if (k && v) m.set(k, v)
  }
  return m
}

export function parseCats(sheets: ReadSheet[]): Cat[] {
  const sheet = sheets.find((s) => s.name === CAT_SHEET)
  const head = sheet?.rows[0]
  if (!sheet || !head) return []
  const iname = head.findIndex((c) => c.trim() === '本子')
  const icolor = head.findIndex((c) => c.trim() === '颜色')
  const iicon = head.findIndex((c) => c.trim() === '图标')
  if (iname < 0) return []
  const out: Cat[] = []
  for (const row of sheet.rows.slice(1)) {
    const cell = (i: number) => (i >= 0 && i < row.length ? row[i].trim() : '')
    const name = cell(iname)
    if (!name || out.some((c) => c.name === name)) continue
    const hex = cell(icolor).replace(/^#/, '')
    const color = /^[0-9a-fA-F]{1,8}$/.test(hex) ? parseInt(hex, 16) | 0 : nextColorOf(out)
    const ic = cell(iicon)
    out.push({ name, color, icon: CAT_ICONS.includes(ic) ? ic : 'box', sort: (out.length + 1) * 10 })
  }
  return out
}

function nextColorOf(used: Cat[]): number {
  return CAT_COLORS.find((c) => !used.some((u) => u.color === c)) ?? CAT_COLORS[used.length % CAT_COLORS.length]
}

export function parseLists(sheets: ReadSheet[]): Item[] {
  const sheet = sheets.find((s) => s.name === LIST_SHEET)
  const head = sheet?.rows[0]
  if (!sheet || !head) return []
  const idx = (k: string) => head.findIndex((c) => c.trim() === k)
  const ic = idx('本子')
  const isec = idx('分区')
  const iname = idx('品名')
  const iunit = idx('单位')
  const imode = idx('填法')
  const ihint = idx('提示')
  if (ic < 0 || iname < 0 || iunit < 0) return []
  const sortBy = new Map<string, number>()
  const seen = new Set<string>()
  const out: Item[] = []
  for (const row of sheet.rows.slice(1)) {
    const cell = (i: number) => (i >= 0 && i < row.length ? row[i].trim() : '')
    const c = cell(ic)
    const name = cell(iname)
    const unit = cell(iunit)
    if (!c || !name || !unit) continue
    const n = (sortBy.get(c) ?? 0) + 10
    sortBy.set(c, n)
    const k = c + '\u0001' + name
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ category: c, section: isec >= 0 ? cell(isec) : '', name, unit, hint: ihint >= 0 ? cell(ihint) : '', weigh: imode >= 0 && cell(imode) === WEIGH_MODE, sort: n })
  }
  return out
}

export function parseDate(s: string): string | null {
  if (!s) return null
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) {
    // Excel 把日期存成数字（1900 日期系统）
    const n = Number(s)
    if (n > 20000 && n < 80000) {
      const d = new Date(1899, 11, 30)
      d.setDate(d.getDate() + Math.trunc(n))
      return toISO(d)
    }
    return null
  }
  const m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(s)
  if (!m) return null
  const y = +m[1]
  const mo = +m[2]
  const d = +m[3]
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return toISO(dt)
}

const key = (r: Rec) => [r.date, r.category, r.name.trim(), fmtQty(r.qty), r.unit.trim(), r.note.trim(), String(!!r.weigh), String(!!r.taken), r.party.trim()].join('\u0001')

/** 同一条记录如果手机里已经有了，就不再导入（按条数抵消，同一天真的记了两次也不会丢）。 */
export function diff(p: Parsed, existing: Rec[]): Preview {
  const counts = new Map<string, number>()
  for (const r of existing) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1)
  const fresh: Rec[] = []
  let dup = 0
  for (const r of p.records) {
    const k = key(r)
    const c = counts.get(k) ?? 0
    if (c > 0) {
      counts.set(k, c - 1)
      dup++
    } else fresh.push(r)
  }
  return { total: p.records.length, fresh, dup, bad: p.bad, items: p.items, cats: p.cats, settings: p.settings }
}
