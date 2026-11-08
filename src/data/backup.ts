// 备份 / 恢复 / 导出，把数据层和表格格式接起来。备份文件跟安卓版通用。
import { today } from './model'
import * as db from './db'
import { DEFAULT_BASE_URL, DEFAULT_MODEL, state } from './db'
import * as Report from '../io/report'
import { readXlsx } from '../io/xlsx'

/** 备份文件“设置”表里认这些名字（跟安卓版一样） */
export const K_KEY = 'ai_key'
export const K_URL = 'ai_base_url'
export const K_MODEL = 'ai_model'
export const K_CAREFUL = 'ai_careful'

/** 写进备份的设置（没填 Key 就不写）。发老板的表格里没有。 */
export function exportSettings(): [string, string][] {
  const p = state.prefs
  if (!p.aiKey.trim()) return []
  return [
    [K_KEY, p.aiKey],
    [K_URL, p.aiBaseUrl],
    [K_MODEL, p.aiModel],
    [K_CAREFUL, p.aiCareful ? '是' : '否'],
  ]
}

export async function importSettings(m: Map<string, string>) {
  const key = (m.get(K_KEY) ?? '').trim()
  if (!key) return
  await db.savePrefs({
    aiKey: key,
    aiBaseUrl: (m.get(K_URL) || DEFAULT_BASE_URL).trim().replace(/\/+$/, ''),
    aiModel: (m.get(K_MODEL) || DEFAULT_MODEL).trim(),
    aiCareful: m.get(K_CAREFUL) === '是',
  })
}

/** 备份：全部记录 + 本子 + 清单 + 设置，做成一个 Excel。同步算完（iPhone 分享要在点按钮那一下里调）。 */
export function makeBackup(): { name: string; bytes: Uint8Array } {
  return {
    name: Report.backupName(today()),
    bytes: Report.build({
      records: db.range(null, null, null),
      from: null,
      to: null,
      category: null,
      items: db.allItems(),
      cats: state.cats,
      withLists: true,
      settings: exportSettings(),
    }),
  }
}

/** 发老板的表格（没有 Key） */
export function makeExport(from: string | null, to: string | null, category: string | null): { name: string; bytes: Uint8Array } {
  return {
    name: Report.fileName(from, to, category, today()),
    bytes: Report.build({ records: db.range(from, to, category), from, to, category, items: db.allItems(), cats: state.cats }),
  }
}

/** 只发清单（别的手机用一样的清单） */
export function makeLists(): { name: string; bytes: Uint8Array } {
  return { name: Report.listsName(today()), bytes: Report.buildLists(db.allItems(), state.cats) }
}

export async function readBackup(file: Blob): Promise<Report.Preview> {
  const buf = new Uint8Array(await file.arrayBuffer())
  let sheets
  try {
    sheets = readXlsx(buf)
  } catch {
    throw new Error('读不了这个文件。请选择本 App（手机版或网页版）备份或导出的 .xlsx 表格。')
  }
  return Report.diff(Report.parse(sheets), db.range(null, null, null))
}

export interface RestoreChoice {
  records: boolean
  lists: boolean
  settings: boolean
}

export async function applyRestore(p: Report.Preview, c: RestoreChoice): Promise<string> {
  const list = c.records ? p.fresh : []
  const items = c.lists ? p.items : []
  const cats = c.lists ? p.cats : []
  const settings = c.settings ? p.settings : new Map<string, string>()
  if (items.length || cats.length) await db.restoreLists(cats, items)
  if (list.length) {
    await db.ensureCategories(list.map((r) => r.category))
    await db.insertAll(list)
  }
  if (settings.size) await importSettings(settings)
  const parts = [list.length ? `记录 ${list.length} 条` : null, items.length ? `清单 ${items.length} 样` : null, settings.size ? '设置' : null].filter(Boolean)
  return '已恢复：' + parts.join('，')
}

export async function markBackup() {
  await db.savePrefs({ lastBackup: today() })
}
