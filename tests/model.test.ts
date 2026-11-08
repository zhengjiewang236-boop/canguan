import { describe, expect, it } from 'vitest'
import { fmtQty, itemSums, newRec, parseQty, rangeOf, takenText, unitTotals, addMonths } from '../src/data/model'

describe('数字', () => {
  it('fmtQty 最多三位小数', () => {
    expect(fmtQty(5)).toBe('5')
    expect(fmtQty(2.5)).toBe('2.5')
    expect(fmtQty(21.235)).toBe('21.235')
    expect(fmtQty(0.1 + 0.2)).toBe('0.3')
    expect(fmtQty(-2)).toBe('-2')
    expect(fmtQty(1.0005)).toBe('1.001')
  })
  it('parseQty 认逗号', () => {
    expect(parseQty('2,5')).toBe(2.5)
    expect(parseQty('2，5')).toBe(2.5)
    expect(parseQty('-3')).toBe(-3)
    expect(parseQty('.5')).toBe(0.5)
    expect(parseQty('abc')).toBeNull()
    expect(parseQty('')).toBeNull()
  })
})

describe('统计', () => {
  const d = '2026-11-02'
  const recs = [
    newRec({ id: 1, date: d, category: '大本', name: '小袋', qty: 5, unit: '箱' }),
    newRec({ id: 2, date: d, category: '大本', name: '小袋', qty: 2, unit: '箱', taken: true, party: '2号店拿走了' }),
    newRec({ id: 3, date: d, category: '牛肉', name: '牛肉', qty: 20.5, unit: '斤', weigh: true }),
    newRec({ id: 4, date: d, category: '牛肉', name: '牛肉', qty: 21.235, unit: '斤', weigh: true }),
  ]
  it('减掉的算负数，称重的算箱', () => {
    const s = itemSums(recs)
    const bag = s.find((x) => x.name === '小袋')!
    expect(bag.unitsText()).toBe('3箱')
    expect(bag.fullText()).toBe('3箱（进5箱，减掉2箱）')
    expect(bag.total).toBe(3)
    const beef = s.find((x) => x.name === '牛肉')!
    expect(beef.unitsText()).toBe('2箱 41.735斤')
    expect([...unitTotals(recs).entries()]).toEqual([
      ['箱', 5],
      ['斤', 41.735],
    ])
  })
  it('减掉的写成一句话', () => {
    expect(takenText(recs[1])).toBe('−2箱 · 2号店拿走了')
    expect(takenText(newRec({ date: d, category: '牛肉', name: '牛肉', qty: 20, unit: '斤', weigh: true, taken: true, party: '退货', note: '坏了' }))).toBe('−1箱 20斤 · 退货（坏了）')
  })
  it('日期范围', () => {
    expect(rangeOf('WEEK', '2026-11-08')).toEqual(['2026-11-02', '2026-11-08'])
    expect(rangeOf('MONTH', '2026-02-10')).toEqual(['2026-02-01', '2026-02-28'])
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  })
})
