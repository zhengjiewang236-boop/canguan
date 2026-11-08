import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as db from '../src/data/db'
import { state } from '../src/data/db'

let n = 0
beforeEach(async () => {
  await db.initDb('test' + n++)
})
afterEach(async () => {
  await db._resetForTests()
})

const D = '2026-11-08'

describe('数据库', () => {
  it('第一次打开写入照片上的清单', () => {
    expect(state.cats.map((c) => c.name)).toEqual(['小本', '大本', '蔬菜', '牛肉'])
    expect(db.itemsOf('小本').length).toBe(10)
    expect(db.itemsOf('大本').length).toBe(54)
    expect(db.itemsOf('牛肉')[0].weigh).toBe(true)
    expect(db.itemsOf('大本')[0].section).toBe('包装')
  })

  it('setQty 只改进的那条，不动减掉的', async () => {
    await db.setQty('大本', D, '小袋', '箱', 5)
    await db.setTaken('大本', D, '小袋', '箱', 2, '2号店拿走了', '')
    await db.setQty('大本', D, '小袋', '箱', 6)
    let recs = db.byDay('大本', D)
    expect(recs.map((r) => [r.qty, r.taken, r.party])).toEqual([
      [2, true, '2号店拿走了'],
      [6, false, ''],
    ])
    await db.setQty('大本', D, '小袋', '箱', 0)
    recs = db.byDay('大本', D)
    expect(recs.length).toBe(1)
    await db.setTaken('大本', D, '小袋', '箱', 0, '', '')
    expect(db.byDay('大本', D).length).toBe(0)
  })

  it('setWeights 换掉这天的称重，不动减掉的一箱', async () => {
    await db.setWeights('牛肉', D, '牛肉', '斤', [20.5, 21.235])
    await db.insert({ date: D, category: '牛肉', name: '牛肉', qty: 19, unit: '斤', note: '', weigh: true, taken: true, party: '退货' })
    await db.setWeights('牛肉', D, '牛肉', '斤', [22, 23, 24])
    const recs = db.byDay('牛肉', D)
    expect(recs.filter((r) => !r.taken).map((r) => r.qty)).toEqual([22, 23, 24])
    expect(recs.filter((r) => r.taken).length).toBe(1)
    expect(db.parties()).toEqual(['退货'])
  })

  it('改品名，以前的记录一起改', async () => {
    await db.setQty('蔬菜', D, '番茄', '箱', 3)
    const it = db.itemsOf('蔬菜').find((i) => i.name === '番茄')!
    await db.saveItem({ ...it, name: '西红柿', unit: '包' }, it)
    expect(db.byDay('蔬菜', D)[0].name).toBe('西红柿')
    expect(db.byDay('蔬菜', D)[0].unit).toBe('包')
    expect(db.itemsOf('蔬菜').map((i) => i.name)).toContain('西红柿')
  })

  it('新增清单项放在分区末尾', async () => {
    await db.saveItem({ category: '大本', section: '食品', name: '糖', unit: '袋', hint: '', weigh: false, sort: 0 }, null)
    const list = db.itemsOf('大本')
    const food = list.filter((i) => i.section === '食品')
    expect(food[food.length - 1].name).toBe('糖')
    // 分区还是挨在一起
    const secs = list.map((i) => i.section)
    expect(secs.indexOf('清洁用品')).toBeGreaterThan(secs.lastIndexOf('食品'))
  })

  it('拖动排序', async () => {
    const ids = db.itemsOf('蔬菜').map((i) => i.id!)
    await db.reorderItems('蔬菜', [...ids].reverse())
    expect(db.itemsOf('蔬菜').map((i) => i.name)[0]).toBe('生菜')
  })

  it('本子：加、改名（清单和记录一起改）、排序、删除', async () => {
    await db.setQty('小本', D, 'BACON', '箱', 1)
    await db.saveCategory({ name: '饮料', color: db.nextColor(), icon: 'drink', sort: 0 }, null)
    expect(state.cats.map((c) => c.name)).toEqual(['小本', '大本', '蔬菜', '牛肉', '饮料'])
    const xb = db.findCat('小本')!
    await db.saveCategory({ ...xb, name: '小单' }, xb)
    expect(db.itemsOf('小单').length).toBe(10)
    expect(db.byDay('小单', D).length).toBe(1)
    await db.reorderCategories([...state.cats].reverse().map((c) => c.id!))
    expect(state.cats[0].name).toBe('饮料')
    await db.deleteCategory('小单')
    expect(db.catNames()).not.toContain('小单')
    // 记录留着
    expect(db.range(null, null, '小单').length).toBe(1)
    await db.ensureCategories(['小单'])
    expect(db.catNames()).toContain('小单')
  })

  it('从备份恢复清单', async () => {
    await db.restoreLists(
      [
        { name: '牛肉', color: 1, icon: 'meat', sort: 10 },
        { name: '新本', color: 2, icon: 'box', sort: 20 },
      ],
      [{ category: '新本', section: '', name: '东西', unit: '个', hint: '', weigh: false, sort: 10 }],
    )
    expect(state.cats.map((c) => c.name)).toEqual(['牛肉', '新本', '小本', '大本', '蔬菜'])
    expect(db.itemsOf('新本').map((i) => i.name)).toEqual(['东西'])
    expect(db.itemsOf('小本').length).toBe(10)
  })

  it('设置会保存', async () => {
    await db.savePrefs({ aiKey: 'sk-test' })
    db._closeForTests()
    await db.initDb('test' + (n - 1))
    expect(state.prefs.aiKey).toBe('sk-test')
    expect(state.prefs.aiModel).toBe('deepseek-flash')
  })
})
