// 数据存在手机浏览器的 IndexedDB 里；启动时全部读进内存（记录不多），改了就写回去再刷新。
// 跟安卓版 Db.kt 一样的读写规则。
import Dexie, { type Table } from 'dexie'
import { markRaw, reactive } from 'vue'
import type { Cat, Item, Rec } from './model'
import { newRec } from './model'
import { allSeeds, CAT_COLORS, DEFAULT_CATS, seedsOf } from './seeds'

class JDB extends Dexie {
  records!: Table<Rec, number>
  items!: Table<Item, number>
  cats!: Table<Cat, number>
  kv!: Table<{ k: string; v: unknown }, string>
  constructor(name: string) {
    super(name)
    this.version(1).stores({
      records: '++id, date, category, [category+date]',
      items: '++id, category',
      cats: '++id, &name',
      kv: 'k',
    })
  }
}

export interface Prefs {
  aiKey: string
  aiBaseUrl: string
  aiModel: string
  aiCareful: boolean
  /** 上次备份的日期 YYYY-MM-DD */
  lastBackup: string | null
}
export const DEFAULT_BASE_URL = 'https://api.deepseek.com'
/** DeepSeek 文档（2026）里能看图片的模型名 */
export const DEFAULT_MODEL = 'deepseek-flash'

export const state = reactive({
  ready: false,
  records: [] as Rec[],
  items: [] as Item[],
  cats: [] as Cat[],
  prefs: { aiKey: '', aiBaseUrl: DEFAULT_BASE_URL, aiModel: DEFAULT_MODEL, aiCareful: false, lastBackup: null } as Prefs,
  /** 数据一变就 +1，页面据此刷新 */
  version: 0,
})

let db: JDB

/** 打开数据库；第一次用时写入照片上的清单。name 只给测试用。 */
export async function initDb(name = 'jizhang'): Promise<void> {
  db = new JDB(name)
  await db.open()
  const seeded = await db.kv.get('seeded')
  if (!seeded) {
    await db.transaction('rw', db.cats, db.items, db.kv, async () => {
      if ((await db.cats.count()) === 0) await db.cats.bulkAdd(DEFAULT_CATS.map((c) => ({ ...c })))
      if ((await db.items.count()) === 0) await db.items.bulkAdd(allSeeds())
      await db.kv.put({ k: 'seeded', v: true })
    })
  }
  const p = (await db.kv.get('prefs'))?.v as Partial<Prefs> | undefined
  Object.assign(state.prefs, { aiKey: '', aiBaseUrl: DEFAULT_BASE_URL, aiModel: DEFAULT_MODEL, aiCareful: false, lastBackup: null }, p ?? {})
  await reload()
  state.ready = true
  // 请浏览器不要自动清掉这些数据
  try {
    await navigator.storage?.persist?.()
  } catch {
    /* 不支持就算了 */
  }
}

async function reload() {
  const [records, items, cats] = await Promise.all([db.records.toArray(), db.items.toArray(), db.cats.toArray()])
  cats.sort((a, b) => a.sort - b.sort || (a.id ?? 0) - (b.id ?? 0))
  const ci = new Map(cats.map((c, i) => [c.name, i]))
  items.sort((a, b) => (ci.get(a.category) ?? 999) - (ci.get(b.category) ?? 999) || a.sort - b.sort || (a.id ?? 0) - (b.id ?? 0))
  // 记录可能很多：不做深层响应，整个数组换掉时页面会刷新
  state.records = markRaw(records)
  state.items = items
  state.cats = cats
  state.version++
}

export async function savePrefs(p: Partial<Prefs>) {
  Object.assign(state.prefs, p)
  await db.kv.put({ k: 'prefs', v: { ...state.prefs } })
}

// ---------------- 读（都在内存里） ----------------

export const catNames = () => state.cats.map((c) => c.name)
export const catIndex = (name: string) => {
  const i = state.cats.findIndex((c) => c.name === name)
  return i < 0 ? 999 : i
}
export const findCat = (name: string) => state.cats.find((c) => c.name === name)

export function byDay(category: string, date: string): Rec[] {
  return state.records.filter((r) => r.category === category && r.date === date).sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
}

export function range(from: string | null, to: string | null, category: string | null): Rec[] {
  return state.records
    .filter((r) => (!from || r.date >= from) && (!to || r.date <= to) && (!category || r.category === category))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
}

export function search(category: string, text: string): Rec[] {
  const t = text.trim()
  return state.records
    .filter((r) => r.category === category && (r.name.includes(t) || r.note.includes(t) || r.party.includes(t)))
    .sort((a, b) => b.date.localeCompare(a.date) || (a.id ?? 0) - (b.id ?? 0))
}

export function days(category: string): { date: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of state.records) if (r.category === category) m.set(r.date, (m.get(r.date) ?? 0) + 1)
  return [...m.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => b.date.localeCompare(a.date))
}

export function countsOn(date: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of state.records) if (r.date === date) m.set(r.category, (m.get(r.category) ?? 0) + 1)
  return m
}

/** 记过的品名（按次数排序），带上次用的单位 */
export function nameHints(category: string): { name: string; unit: string }[] {
  const g = new Map<string, { n: number; maxId: number; unit: string }>()
  for (const r of state.records) {
    if (r.category !== category) continue
    const e = g.get(r.name)
    const id = r.id ?? 0
    if (!e) g.set(r.name, { n: 1, maxId: id, unit: r.unit })
    else {
      e.n++
      if (id > e.maxId) {
        e.maxId = id
        e.unit = r.unit
      }
    }
  }
  return [...g.entries()]
    .sort((a, b) => b[1].n - a[1].n || b[1].maxId - a[1].maxId)
    .slice(0, 40)
    .map(([name, e]) => ({ name, unit: e.unit }))
}

export function usedUnits(): string[] {
  const m = new Map<string, number>()
  for (const r of state.records) m.set(r.unit, (m.get(r.unit) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u)
}

/** 用过的“减掉”原因（常用的在前） */
export function parties(): string[] {
  const g = new Map<string, { n: number; maxId: number }>()
  for (const r of state.records) {
    if (!r.taken || !r.party.trim()) continue
    const e = g.get(r.party) ?? { n: 0, maxId: 0 }
    e.n++
    e.maxId = Math.max(e.maxId, r.id ?? 0)
    g.set(r.party, e)
  }
  return [...g.entries()]
    .sort((a, b) => b[1].n - a[1].n || b[1].maxId - a[1].maxId)
    .slice(0, 30)
    .map(([p]) => p)
}

export function itemsOf(category: string): Item[] {
  return state.items.filter((i) => i.category === category)
}
export function allItems(): Item[] {
  return state.items.filter((i) => catIndex(i.category) < 999)
}

export function categoryCounts(): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>()
  for (const i of state.items) {
    const e = m.get(i.category) ?? [0, 0]
    e[0]++
    m.set(i.category, e)
  }
  for (const r of state.records) {
    const e = m.get(r.category) ?? [0, 0]
    e[1]++
    m.set(r.category, e)
  }
  return m
}

// ---------------- 写 ----------------

function clean(r: Rec): Rec {
  return {
    ...(r.id != null ? { id: r.id } : {}),
    date: r.date,
    category: r.category,
    name: r.name.trim(),
    qty: r.qty,
    unit: r.unit.trim(),
    note: r.note.trim(),
    weigh: !!r.weigh,
    taken: !!r.taken,
    party: r.taken ? r.party.trim() : '',
    created: r.created ?? Date.now(),
  }
}

async function write<T>(tables: Table[], fn: () => Promise<T>): Promise<T> {
  const res = await db.transaction('rw', tables, fn)
  await reload()
  return res
}

const sameDay = (category: string, date: string) => db.records.where('[category+date]').equals([category, date])

export async function insert(r: Rec): Promise<number> {
  const c = clean(r)
  delete c.id
  return write([db.records], () => db.records.add(c))
}
export async function insertAll(list: Rec[]) {
  await write([db.records], () =>
    db.records.bulkAdd(
      list.map((r) => {
        const c = clean(r)
        delete c.id
        return c
      }),
    ),
  )
}
/** 撤销删除：原样放回 */
export async function restore(r: Rec) {
  await write([db.records], () => db.records.put(clean(r)))
}
export async function update(r: Rec) {
  await write([db.records], () => db.records.put(clean(r)))
}
export async function remove(id: number) {
  await write([db.records], () => db.records.delete(id))
}

/** 填数量的东西：把这天这一样（进的）改成 qty（0 = 清空）。减掉的那条不动。 */
export async function setQty(category: string, date: string, name: string, unit: string, qty: number) {
  await write([db.records], async () => {
    await sameDay(category, date)
      .filter((r) => r.name === name && r.unit === unit && !r.weigh && !r.taken)
      .delete()
    if (qty > 0) await db.records.add(clean(newRec({ date, category, name, qty, unit })))
  })
}

/** 每箱称重：把这天这一样（进的）换成 weights（一个数一箱） */
export async function setWeights(category: string, date: string, name: string, unit: string, weights: number[]) {
  await write([db.records], async () => {
    await sameDay(category, date)
      .filter((r) => r.name === name && r.unit === unit && r.weigh && !r.taken)
      .delete()
    for (const w of weights.filter((w) => w > 0)) await db.records.add(clean(newRec({ date, category, name, qty: w, unit, weigh: true })))
  })
}

/** 填数量的东西变成负数：把这天这一样“减掉的”换成 qty（0 = 不减了） */
export async function setTaken(category: string, date: string, name: string, unit: string, qty: number, reason: string, note: string) {
  await write([db.records], async () => {
    await sameDay(category, date)
      .filter((r) => r.name === name && r.unit === unit && !r.weigh && r.taken)
      .delete()
    if (qty > 0) await db.records.add(clean(newRec({ date, category, name, qty, unit, note, taken: true, party: reason })))
  })
}

/** 先读后写的几步放在一个事务里（比如：清掉进货 + 写减掉的） */
export async function batch(fn: () => Promise<void>) {
  await fn()
}

// ---------------- 清单 ----------------

async function itemsOfDb(category: string): Promise<Item[]> {
  const l = await db.items.where('category').equals(category).toArray()
  return l.sort((a, b) => a.sort - b.sort || (a.id ?? 0) - (b.id ?? 0))
}

/** 重新编号：同一分区的放在一起，按现在的先后 10、20、30… */
async function renumber(category: string) {
  const list = await itemsOfDb(category)
  const sections = [...new Set(list.map((i) => i.section))]
  const ordered = sections.flatMap((s) => list.filter((i) => i.section === s))
  for (let i = 0; i < ordered.length; i++) await db.items.update(ordered[i].id!, { sort: (i + 1) * 10 })
}

async function slot(category: string, section: string, exceptId: number): Promise<number> {
  const list = (await itemsOfDb(category)).filter((i) => i.id !== exceptId)
  const inSection = list.filter((i) => i.section === section)
  return inSection.length ? Math.max(...inSection.map((i) => i.sort)) + 5 : (list.length ? Math.max(...list.map((i) => i.sort)) : 0) + 10
}

function cleanItem(i: Item): Item {
  return {
    ...(i.id != null ? { id: i.id } : {}),
    category: i.category,
    section: i.section.trim(),
    name: i.name.trim(),
    unit: i.unit.trim(),
    hint: i.hint.trim(),
    weigh: !!i.weigh,
    sort: i.sort,
  }
}

/** 新增（old = null）或修改。改名 / 改单位时，以前的记录一起改。 */
export async function saveItem(item: Item, old: Item | null) {
  await write([db.items, db.records], async () => {
    const it = cleanItem(item)
    if (!old) {
      delete it.id
      it.sort = await slot(it.category, it.section, -1)
      await db.items.add(it)
      await renumber(it.category)
    } else {
      const moved = old.category !== it.category || old.section !== it.section
      it.sort = moved ? await slot(it.category, it.section, old.id!) : old.sort
      it.id = old.id
      await db.items.put(it)
      if (old.category === it.category && (old.name !== it.name || old.unit !== it.unit)) {
        await db.records
          .where('category')
          .equals(old.category)
          .filter((r) => r.name === old.name && r.unit === old.unit)
          .modify({ name: it.name, unit: it.unit })
      }
      await renumber(it.category)
      if (old.category !== it.category) await renumber(old.category)
    }
  })
}

export async function deleteItem(id: number) {
  await write([db.items], () => db.items.delete(id))
}

export async function reorderItems(category: string, ids: number[]) {
  await write([db.items], async () => {
    for (let i = 0; i < ids.length; i++) await db.items.update(ids[i], { sort: (i + 1) * 10 })
    await renumber(category)
  })
}

export async function resetItems(category: string) {
  await write([db.items], async () => {
    await db.items.where('category').equals(category).delete()
    await db.items.bulkAdd(seedsOf(category))
  })
}

// ---------------- 本子 ----------------

export function nextColor(used: Cat[] = state.cats): number {
  return CAT_COLORS.find((c) => !used.some((u) => u.color === c)) ?? CAT_COLORS[used.length % CAT_COLORS.length]
}

export async function saveCategory(cat: Cat, old: Cat | null) {
  await write([db.cats, db.items, db.records], async () => {
    const name = cat.name.trim()
    if (!old) {
      const all = await db.cats.toArray()
      const max = all.length ? Math.max(...all.map((c) => c.sort)) : 0
      await db.cats.add({ name, color: cat.color, icon: cat.icon, sort: max + 10 })
    } else {
      await db.cats.put({ id: old.id, name, color: cat.color, icon: cat.icon, sort: old.sort })
      if (old.name !== name) {
        await db.items.where('category').equals(old.name).modify({ category: name })
        await db.records.where('category').equals(old.name).modify({ category: name })
      }
    }
  })
}

/** 删掉本子和它的清单；以前记的数字留着 */
export async function deleteCategory(name: string) {
  await write([db.cats, db.items], async () => {
    await db.cats.where('name').equals(name).delete()
    await db.items.where('category').equals(name).delete()
  })
}

export async function reorderCategories(ids: number[]) {
  await write([db.cats], async () => {
    for (let i = 0; i < ids.length; i++) await db.cats.update(ids[i], { sort: (i + 1) * 10 })
  })
}

/** 导入的记录里有手机上没有的本子，就自动加上 */
export async function ensureCategories(names: string[]) {
  await write([db.cats], async () => {
    let cats = await db.cats.toArray()
    for (const n of [...new Set(names.map((s) => s.trim()).filter(Boolean))]) {
      if (!cats.some((c) => c.name === n)) {
        const max = cats.length ? Math.max(...cats.map((c) => c.sort)) : 0
        await db.cats.add({ name: n, color: nextColor(cats), icon: 'box', sort: max + 10 })
        cats = await db.cats.toArray()
      }
    }
  })
}

/** 从备份恢复：文件里的本子按文件顺序排前面、清单换成文件里的；手机上多出来的本子留着 */
export async function restoreLists(cats: Cat[], items: Item[]) {
  await write([db.cats, db.items], async () => {
    const fileCats = [...new Set([...cats.map((c) => c.name), ...items.map((i) => i.category)])]
    const existing = await db.cats.toArray()
    for (let i = 0; i < fileCats.length; i++) {
      const name = fileCats[i]
      const fromFile = cats.find((c) => c.name === name)
      const have = existing.find((c) => c.name === name)
      const base = fromFile ?? have ?? { name, color: nextColor(existing), icon: 'box', sort: 0 }
      const c = { name: base.name, color: base.color, icon: base.icon, sort: (i + 1) * 10 }
      if (have) await db.cats.put({ ...c, id: have.id })
      else await db.cats.add(c)
    }
    const rest = existing.filter((c) => !fileCats.includes(c.name))
    for (let i = 0; i < rest.length; i++) await db.cats.update(rest[i].id!, { sort: (fileCats.length + i + 1) * 10 })
    const byCat = new Map<string, Item[]>()
    for (const it of items) byCat.set(it.category, [...(byCat.get(it.category) ?? []), it])
    for (const [c, list] of byCat) {
      await db.items.where('category').equals(c).delete()
      await db.items.bulkAdd(list.map((it, i) => ({ ...cleanItem(it), id: undefined, sort: (i + 1) * 10 }) as Item))
      await renumber(c)
    }
  })
}

/** 测试用：只关掉 */
export function _closeForTests() {
  db?.close()
}

/** 测试用：关掉并删掉数据库 */
export async function _resetForTests() {
  if (db) {
    db.close()
    await db.delete()
  }
}
