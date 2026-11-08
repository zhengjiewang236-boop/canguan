/// <reference types="node" />
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Cat, Item, Rec } from '../src/data/model'
import { newRec } from '../src/data/model'
import { allSeeds, DEFAULT_CATS } from '../src/data/seeds'
import * as Report from '../src/io/report'
import { readXlsx } from '../src/io/xlsx'

const d = '2026-11-05'
const d2 = '2026-11-06'
const recs: Rec[] = [
  newRec({ id: 1, date: d, category: '大本', name: '小袋', qty: 5, unit: '箱' }),
  newRec({ id: 2, date: d, category: '大本', name: '小袋', qty: 2, unit: '箱', taken: true, party: '2号店拿走了' }),
  newRec({ id: 3, date: d, category: '牛肉', name: '牛肉', qty: 21.235, unit: '斤', weigh: true }),
  newRec({ id: 4, date: d, category: '牛肉', name: '牛肉', qty: 20.5, unit: '斤', weigh: true }),
  newRec({ id: 5, date: d, category: '牛肉', name: '牛肉', qty: 19, unit: '斤', note: '坏了', weigh: true, taken: true, party: '退货' }),
  newRec({ id: 6, date: d2, category: '蔬菜', name: '番茄', qty: 3, unit: '箱', note: '要红的 & <大>' }),
  newRec({ id: 7, date: d2, category: '饮料', name: '可乐', qty: 4, unit: '箱' }),
]
const cats: Cat[] = [...DEFAULT_CATS, { name: '饮料', color: 0xff8a4fa3 | 0, icon: 'drink', sort: 50 }]
const items: Item[] = [
  ...allSeeds(),
  ...['可乐|箱', '雪碧|箱', '水|打', '果汁|箱'].map((s, i) => {
    const [name, unit] = s.split('|')
    return { category: '饮料', section: '', name, unit, hint: '', weigh: false, sort: (i + 1) * 10 }
  }),
]
const now = new Date(2026, 10, 8, 10, 0)

function backup() {
  return Report.build({
    records: recs,
    from: null,
    to: null,
    category: null,
    now,
    items,
    cats,
    withLists: true,
    settings: [
      ['ai_key', 'sk-web'],
      ['ai_base_url', 'https://api.deepseek.com'],
      ['ai_model', 'deepseek-flash'],
      ['ai_careful', '否'],
    ],
  })
}

describe('Excel', () => {
  it('备份：表的顺序、明细、清单、本子、设置', () => {
    const sheets = readXlsx(backup())
    expect(sheets.map((s) => s.name)).toEqual(['汇总', '每日', '减掉的', '小本', '大本', '蔬菜', '牛肉', '饮料', '明细', '清单', '本子', '设置'])
    const sum = sheets[0]
    expect(sum.rows[0][0]).toBe('餐馆记账 · 汇总 · 11区 Faidherbe')
    expect(sum.rows[1][0]).toBe('时间：全部日期　类别：全部　共 7 条记录　导出：2026-11-08 10:00')
    expect(sum.rows[3]).toEqual(['类别', '品名', '箱', '斤', '总数', '次数', '进货', '减掉', '减掉的原因'])
    const bag = sum.rows.find((r) => r[1] === '小袋')!
    expect(bag).toEqual(['大本', '小袋', '3', '', '3', '1', '5箱', '2箱', '11/5 −2箱 · 2号店拿走了'])
    const beef = sum.rows.find((r) => r[1] === '牛肉')!
    expect(beef.slice(0, 6)).toEqual(['牛肉', '牛肉', '1', '22.735', '1', '2'])
    const book = sheets.find((s) => s.name === '牛肉')!
    expect(book.rows[3]).toEqual(['分区', '品名', '单位', '11-5 周四', '合计'])
    expect(book.rows[4]).toEqual(['', '牛肉（箱数）', '箱', '1', '1'])
    expect(book.rows[5]).toEqual(['', '牛肉（斤数）', '斤', '22.735', '22.735'])
    const drinks = sheets.find((s) => s.name === '饮料')!
    expect(drinks.rows[4]).toEqual(['', '可乐', '箱', '4', '4'])
    const taken = sheets.find((s) => s.name === '减掉的')!
    expect(taken.rows[2]).toEqual(['2026-11-05', '星期四', '牛肉', '牛肉（1箱）', '19', '斤', '退货', '坏了'])
    const cat = sheets.find((s) => s.name === '本子')!
    expect(cat.rows[5]).toEqual(['饮料', '#FF8A4FA3', 'drink'])
  })

  it('读回来：记录、清单、本子、设置都一样；再导入全是重复', () => {
    const p = Report.parse(readXlsx(backup()))
    expect(p.bad).toBe(0)
    expect(p.records.length).toBe(7)
    const strip = (r: Rec) => ({ ...r, id: undefined })
    expect(p.records.map((r) => strip(r))).toEqual(recs.map((r) => strip({ ...r, created: undefined })).map((r) => ({ ...r, id: undefined })).map(({ id, created, ...x }) => x))
    expect(p.cats.map((c) => [c.name, c.color, c.icon])).toEqual(cats.map((c) => [c.name, c.color, c.icon]))
    expect(p.items.length).toBe(75)
    expect(p.items.find((i) => i.name === '铝盒')!.hint).toBe('最少5包')
    expect(p.settings.get('ai_key')).toBe('sk-web')
    const again = Report.diff(p, recs)
    expect(again.fresh.length).toBe(0)
    expect(again.dup).toBe(7)
    // 给安卓版的测试读
    mkdirSync('build/compat', { recursive: true })
    writeFileSync('build/compat/web-backup.xlsx', backup())
  })

  it('发老板的表格没有设置、没有清单', () => {
    const sheets = readXlsx(Report.build({ records: recs, from: d, to: d, category: '牛肉', now, items, cats }))
    expect(sheets.map((s) => s.name)).toEqual(['汇总', '每日', '减掉的', '牛肉', '明细'])
    expect(sheets[0].rows[1][0]).toBe('时间：2026-11-05（星期四）　类别：牛肉　共 7 条记录　导出：2026-11-08 10:00')
  })

  it('文件名', () => {
    expect(Report.fileName(null, null, null, '2026-11-08')).toBe('餐馆记账_全部_全部日期_截至2026-11-08.xlsx')
    expect(Report.fileName(d, d, '牛肉', '2026-11-08')).toBe('餐馆记账_牛肉_2026-11-05.xlsx')
    expect(Report.fileName('2026-11-01', '2026-11-30', null, '2026-11-08')).toBe('餐馆记账_全部_2026-11-01至2026-11-30.xlsx')
    expect(Report.backupName('2026-11-08')).toBe('餐馆记账备份_2026-11-08.xlsx')
  })

  it('日期：文字和 Excel 数字都认', () => {
    expect(Report.parseDate('2026-11-05')).toBe('2026-11-05')
    expect(Report.parseDate('2026/1/5')).toBe('2026-01-05')
    expect(Report.parseDate('46331')).toBe('2026-11-05')
    expect(Report.parseDate('2026-02-30')).toBeNull()
  })

  const android = 'tests/fixtures/android-backup.xlsx'
  it.runIf(existsSync(android))('能读安卓版的备份', () => {
    const sheets = readXlsx(new Uint8Array(readFileSync(android)))
    expect(sheets.map((s) => s.name)).toEqual(['汇总', '每日', '减掉的', '小本', '大本', '蔬菜', '牛肉', '饮料', '明细', '清单', '本子', '设置'])
    const p = Report.parse(sheets)
    expect(p.bad).toBe(0)
    expect(p.records.map(({ id, created, ...x }) => x)).toEqual(recs.map(({ id, created, ...x }) => x))
    expect(p.cats.map((c) => [c.name, c.color, c.icon])).toEqual(cats.map((c) => [c.name, c.color, c.icon]))
    expect(p.items.length).toBe(71)
    expect(p.settings.get('ai_key')).toBe('sk-android')
    // 网页版自己生成的跟安卓版一模一样（除了清单多了饮料的 4 样）
    const mine = readXlsx(backup())
    for (const name of ['汇总', '每日', '减掉的', '小本', '大本', '蔬菜', '牛肉', '明细']) {
      expect(mine.find((s) => s.name === name)!.rows, name).toEqual(sheets.find((s) => s.name === name)!.rows)
    }
  })
})
