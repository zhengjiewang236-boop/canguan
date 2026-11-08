import { describe, expect, it } from 'vitest'
import { seedsOf } from '../src/data/seeds'
import { find, match, norm, parse, systemPrompt } from '../src/io/recognize'

const big = seedsOf('大本').map((it, i) => ({ ...it, id: i + 1 }))
const veg = seedsOf('蔬菜').map((it, i) => ({ ...it, id: 100 + i }))
const beef = seedsOf('牛肉').map((it, i) => ({ ...it, id: 200 + i }))

describe('拍照识别', () => {
  it('提示词里有清单', () => {
    const p = systemPrompt('牛肉', beef, '2026-11-08')
    expect(p).toContain('牛肉｜斤｜-｜每箱称重')
    expect(p).toContain('年份看不出来就用 2026')
    expect(p.trim().endsWith('"unit": "袋"}]}')).toBe(true)
  })
  it('norm：全角变半角、去空格、小写', () => {
    expect(norm(' 手套　Ｍ ')).toBe('手套m')
    expect(norm('土豆（25kg）')).toBe('土豆(25kg)')
    expect(norm('土豆(25KG)')).toBe('土豆(25kg)')
  })
  it('find：括号、包含、唯一才算', () => {
    expect(find(veg, '土豆')).toBeNull() // 两样土豆分不清
    expect(find(veg, '番茄')!.name).toBe('番茄')
    expect(find(veg, '生菜(箱)')!.name).toBe('生菜')
    expect(find(big, '锡纸')!.name).toBe('锡纸 30CM')
    expect(find(big, '手套')).toBeNull()
    expect(find(big, '手套m')!.name).toBe('手套 M')
  })
  it('parse + match', () => {
    const raw = parse(
      '好的：```json\n{"date":"2026-11-07","items":[{"name":"小袋","qty":3},{"name":"小袋","qty":"2箱"},{"name":"蜂蜜","qty":1,"sure":false}],' +
        '"weights":[],"others":[{"name":"可乐","qty":2,"unit":"箱"}]}\n```',
    )
    expect(raw.date).toBe('2026-11-07')
    const r = match(big, raw)
    expect(r.counts.map((c) => [c.item.name, c.qty, c.sure])).toEqual([
      ['小袋', 5, false],
      ['蜂蜜', 1, false],
    ])
    expect(r.others).toEqual([{ name: '可乐', qty: 2, unit: '箱' }])
  })
  it('牛肉：每箱一个数，合计另外读', () => {
    const raw = parse('{"date":null,"items":[],"weights":[{"name":"牛肉","values":[20.92,21.235,"19,5"],"sure":true,"paper_count":3,"paper_total":61.655}],"others":[]}')
    const r = match(beef, raw)
    expect(r.weights[0].values).toEqual([20.92, 21.235, 19.5])
    expect(r.weights[0].paperCount).toBe(3)
    expect(r.weights[0].paperTotal).toBe(61.655)
    expect(r.date).toBeNull()
  })
  it('回答不是 JSON 就报错', () => {
    expect(() => parse('看不清')).toThrow('AI 没有按格式回答')
  })
})
