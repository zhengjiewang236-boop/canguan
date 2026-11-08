// 照片上的清单（第一次打开时写进手机，之后在“设置”里改）。跟安卓版一样。
import type { Cat, Item } from './model'

export const DEFAULT_CATS: Cat[] = [
  { name: '小本', color: 0xff2f7d95 | 0, icon: 'edit', sort: 10 },
  { name: '大本', color: 0xff5a5fa8 | 0, icon: 'book', sort: 20 },
  { name: '蔬菜', color: 0xff3f8f3a | 0, icon: 'eco', sort: 30 },
  { name: '牛肉', color: 0xffb4432c | 0, icon: 'meat', sort: 40 },
]

/** 新本子可选的颜色 */
export const CAT_COLORS: number[] = [
  0xff2f7d95, 0xff5a5fa8, 0xff3f8f3a, 0xffb4432c, 0xff8a4fa3, 0xff7a5a33, 0xffb0436e, 0xff2d6cb5, 0xff4e6a7a, 0xff6f7f2a,
].map((c) => c | 0)

export const CAT_ICONS = ['edit', 'book', 'eco', 'meat', 'drink', 'box', 'clean', 'cart', 'fish', 'egg', 'bread', 'ice']

function build(category: string, sections: [string, string[]][]): Item[] {
  let n = 0
  return sections.flatMap(([section, specs]) =>
    specs.map((spec) => {
      const [name, unit, hint = ''] = spec.split('|')
      n += 10
      return { category, section, name, unit, hint, weigh: false, sort: n }
    }),
  )
}

const 小本 = build('小本', [['', ['1|箱', '2|箱', '3|箱', 'CHEDDAR|箱', 'FONDANT|箱', 'CREME|箱', 'KETCHUP|箱', 'BACON|箱', 'X粉|箱', 'K粉|箱']]])

const 大本 = build('大本', [
  ['包装', ['小袋|箱', '大袋|箱', '薯条袋|箱', '甜品袋|箱', 'F袋|箱', '汉堡盒|箱', 'FCD|箱', '纸杯|箱', '纸巾|箱', '绿番茄盒|箱', 'C盒|包', '餐盘纸|箱', '薯条叉|箱', '勺子|箱', '双层肉叉|箱']],
  ['食品', ['蜂蜜|箱', '橄榄油|箱', '番茄酱|箱', '白醋|箱', '小瓶水|打', '盐|打', '大瓶水|打']],
  [
    '清洁用品',
    [
      '蓝色厨房布|箱', '绿色门口布|箱', '一次性围裙|包', '厨房帽子|箱', '手套 M|箱', '手套 L|箱', '厨房纸|包', '厕所纸|包', '保鲜膜|箱',
      '锡纸 30CM|箱', '铝盒|包|最少5包', '海绵擦|包', '铁丝球|包', '扫地棍子|根', '刮地头|个', '垃圾袋 160|箱', '垃圾袋 50|箱', '拖把头|个',
    ],
  ],
  ['清洁液', ['3D黄水|箱', '红水带喷头|桶', '洗手液|桶', '洗洁精|桶', '爆炸粉|桶', '洗碗机蓝水|桶', '洗碗机白水|桶', '洗碗机粗盐|袋']],
  ['办公用品', ['发票纸|箱', 'CB纸|箱', 'A4白纸|箱', 'GAZ|个', '订书机|个', '订书钉|箱']],
])

const 蔬菜 = build('蔬菜', [['', ['土豆(25kg)|袋', '土豆(10kg)|袋', '洋葱(10kg)|袋', '洋葱(5kg)|袋', '番茄|箱', '生菜|箱']]])

const 牛肉: Item[] = [
  { category: '牛肉', section: '', name: '牛肉', unit: '斤', hint: '每箱称一下填斤数，一个数就是一箱', weigh: true, sort: 10 },
]

export function seedsOf(category: string): Item[] {
  switch (category) {
    case '小本':
      return 小本.map((i) => ({ ...i }))
    case '大本':
      return 大本.map((i) => ({ ...i }))
    case '蔬菜':
      return 蔬菜.map((i) => ({ ...i }))
    case '牛肉':
      return 牛肉.map((i) => ({ ...i }))
    default:
      return []
  }
}

export function allSeeds(): Item[] {
  return DEFAULT_CATS.flatMap((c) => seedsOf(c.name))
}
