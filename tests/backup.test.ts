import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as db from '../src/data/db'
import { makeBackup } from '../src/data/backup'
import { newRec } from '../src/data/model'
import { parse } from '../src/io/report'
import { readXlsx } from '../src/io/xlsx'

let n = 0
beforeEach(async () => {
  await db.initDb('backup' + n++)
  await db.savePrefs({ aiKey: 'sk-test' })
  await db.insert(newRec({ date: '2026-10-30', category: '大本', name: '小袋', qty: 2, unit: '箱' }))
  await db.insert(newRec({ date: '2026-11-05', category: '大本', name: '小袋', qty: 5, unit: '箱' }))
  await db.insert(newRec({ date: '2026-11-06', category: '牛肉', name: '牛肉', qty: 20.5, unit: '斤', weigh: true }))
})
afterEach(() => db._resetForTests())

describe('备份', () => {
  it('全部：所有记录 + 本子 + 清单 + Key', () => {
    const b = makeBackup()
    expect(b.name).toMatch(/^餐馆记账备份_\d{4}-\d{2}-\d{2}\.xlsx$/)
    const p = parse(readXlsx(b.bytes))
    expect(p.records.length).toBe(3)
    expect(p.items.length).toBe(71)
    expect(p.cats.map((c) => c.name)).toEqual(['小本', '大本', '蔬菜', '牛肉'])
    expect(p.settings.get('ai_key')).toBe('sk-test')
  })
  it('选日期：只有这段时间的记录，本子、清单、Key 照样带上', () => {
    const b = makeBackup('2026-11-01', '2026-11-30')
    expect(b.name).toBe('餐馆记账备份_2026-11-01至2026-11-30.xlsx')
    const sheets = readXlsx(b.bytes)
    expect(sheets[0].rows[1][0]).toContain('时间：2026-11-01 至 2026-11-30')
    const p = parse(sheets)
    expect(p.records.map((r) => r.date)).toEqual(['2026-11-05', '2026-11-06'])
    expect(p.items.length).toBe(71)
    expect(p.cats.length).toBe(4)
    expect(p.settings.get('ai_key')).toBe('sk-test')
  })
})
