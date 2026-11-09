// 把统计画成一张长图，方便发微信 / WhatsApp。跟安卓版 StatsImage.kt 一样的样子。
// 先“量”一遍算出总高度，再真正画（同一段代码，draw=false 时只量不画）。
import type { Rec } from '../data/model'
import { STORE_NAME, daySums, fromISO, itemSums, shortDateWeek, takenText, toISO } from '../data/model'

const W = 1080
const PAD = 48
const MAX_H = 12000

const BG = '#F8F6F1'
const PRIMARY = '#2E5E4E'
const TEXT = '#1C1B18'
const MUTED = '#6B675E'
const LINE = '#E3DFD5'
const CARD = '#FFFFFF'
const TAKEN = '#C0582B'

const FONT = `-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Noto Sans SC", "Microsoft YaHei", sans-serif`

export interface ImageOpts {
  records: Rec[]
  order: Map<string, number>
  catIndex: (c: string) => number
  colorOf: (c: string) => string
  rangeText: string
  catText: string
  byDay: boolean
  now?: Date
}

class Pen {
  constructor(
    public c: CanvasRenderingContext2D,
    public draw: boolean,
  ) {}
  font(size: number, bold = false) {
    this.c.font = `${bold ? '700' : '400'} ${size}px ${FONT}`
  }
  measure(t: string, size: number, bold = false) {
    this.font(size, bold)
    return this.c.measureText(t).width
  }
  text(t: string, x: number, y: number, size: number, color: string, bold = false) {
    if (!this.draw) return
    this.font(size, bold)
    this.c.fillStyle = color
    this.c.fillText(t, x, y)
  }
  rect(x: number, y: number, w: number, h: number, color: string, r = 0) {
    if (!this.draw) return
    this.c.fillStyle = color
    this.c.beginPath()
    if (r > 0) this.c.roundRect(x, y, w, h, r)
    else this.c.rect(x, y, w, h)
    this.c.fill()
  }
  fit(t: string, size: number, bold: boolean, max: number) {
    if (this.measure(t, size, bold) <= max) return t
    let s = [...t]
    while (s.length && this.measure(s.join('') + '…', size, bold) > max) s = s.slice(0, -1)
    return s.join('') + '…'
  }
}

function nowText(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${toISO(d)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 返回内容总高度 */
function paint(p: Pen, o: ImageOpts): number {
  const { records, order, catIndex } = o
  let y = 0
  const headH = 200
  p.rect(0, 0, W, headH, PRIMARY)
  p.text(`进货统计 · ${STORE_NAME}`, PAD, 92, 54, '#FFFFFF', true)
  p.text(p.fit(`${o.rangeText}　${o.catText}`, 34, false, W - 2 * PAD), PAD, 152, 34, 'rgba(255,255,255,0.87)')
  y = headH + 36

  // 几笔、几种（不同的东西不加在一起，所以没有“总数量”）
  const stats: [string, string][] = [
    [String(records.length), '笔记录'],
    [String(itemSums(records).length), '种东西'],
  ]
  const colW = (W - 2 * PAD) / 3
  stats.forEach(([v, l], i) => {
    p.text(v, PAD + i * colW, y + 64, 68, PRIMARY, true)
    p.text(l, PAD + i * colW, y + 108, 32, MUTED)
  })
  y += 132 + 24

  if (!records.length) {
    p.text('这段时间没有记录', PAD, y + 50, 40, MUTED)
    y += 90
  } else if (!o.byDay) {
    // 按品名：每个本子一块
    const sums = itemSums(records, order, catIndex)
    const groups = new Map<string, typeof sums>()
    for (const s of sums) groups.set(s.category, [...(groups.get(s.category) ?? []), s])
    for (const [cat, list] of groups) {
      const n = records.filter((r) => r.category === cat).length
      y += 20
      y = tag(p, cat, y, `${list.length} 种 · ${n} 笔`, o.colorOf(cat))
      y = table(
        p,
        list.map((s) => [s.name, s.fullText()]),
        y,
      )
    }
  } else {
    // 按日期：几号进了什么
    for (const d of daySums(records, false, order, catIndex)) {
      y += 20
      p.rect(PAD - 8, y, W - 2 * PAD + 16, 80, CARD, 18)
      p.text(shortDateWeek(d.date), PAD + 16, y + 54, 42, TEXT, true)
      const right = `${d.items.length} 种`
      p.text(right, W - PAD - 16 - p.measure(right, 38, true), y + 54, 38, PRIMARY, true)
      y += 92
      // 每个本子分开一块（小本、大本……不混在一起）
      const groups = new Map<string, typeof d.items>()
      for (const s of d.items) groups.set(s.category, [...(groups.get(s.category) ?? []), s])
      const many = groups.size > 1 || o.catText === '全部本子'
      for (const [cat, list] of groups) {
        if (many) y = tag(p, cat, y + 4, `${list.length} 种`, o.colorOf(cat))
        y = table(
          p,
          list.map((s) => [s.name, s.unitsText()]),
          y,
        )
      }
    }
  }

  // 减掉的（月底对账）：哪天、哪样、多少、原因
  const taken = records.filter((r) => r.taken).sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
  if (taken.length) {
    y += 20
    y = tag(p, '减掉的', y, `${taken.length} 笔`, TAKEN)
    y = table(
      p,
      taken.map((r) => {
        const d = fromISO(r.date)
        return [`${d.getMonth() + 1}/${d.getDate()} ${r.name}`, takenText(r)]
      }),
      y,
    )
  }

  y += 40
  const foot = `生成时间 ${nowText(o.now ?? new Date())} · 餐馆记账`
  p.text(foot, (W - p.measure(foot, 30)) / 2, y + 30, 30, MUTED)
  y += 80
  return y
}

function tag(p: Pen, cat: string, y: number, side: string, color: string): number {
  const w = p.measure(cat, 38, true) + 40
  p.rect(PAD, y, w, 60, color, 14)
  p.text(cat, PAD + 20, y + 44, 38, '#FFFFFF', true)
  p.text(side, PAD + w + 20, y + 44, 34, MUTED)
  return y + 76
}

/** 两列表：左边品名，右边“3箱 1袋”。右边放不下就换到下一行。 */
function table(p: Pen, rows: [string, string][], top: number): number {
  let y = top
  const left = PAD
  const right = W - PAD
  const inner = right - left - 48
  const heights = rows.map(([l, r]) => (p.measure(l, 40) + 32 + p.measure(r, 40, true) <= inner ? 76 : 128))
  const h = heights.reduce((a, b) => a + b, 0)
  p.rect(left, y, right - left, h, CARD, 22)
  rows.forEach(([l, r], i) => {
    const rh = heights[i]
    if (i > 0) p.rect(left + 24, y, right - left - 48, 2, LINE)
    if (rh <= 76) {
      p.text(l, left + 24, y + 52, 40, TEXT)
      p.text(r, right - 24 - p.measure(r, 40, true), y + 52, 40, TEXT, true)
    } else {
      p.text(p.fit(l, 40, false, inner), left + 24, y + 52, 40, TEXT)
      const rr = p.fit(r, 40, true, inner)
      p.text(rr, right - 24 - p.measure(rr, 40, true), y + 106, 40, TEXT, true)
    }
    y += rh
  })
  return y + 8
}

/** 画好的 PNG（Blob）。iPhone 上画布太大会失败，所以最长 12000 像素，超过就整体缩小。 */
export async function renderStats(o: ImageOpts): Promise<Blob> {
  const probe = document.createElement('canvas').getContext('2d')!
  const h = paint(new Pen(probe, false), o)
  const scale = h > MAX_H ? MAX_H / h : 1
  const c = document.createElement('canvas')
  c.width = Math.floor(W * scale)
  c.height = Math.max(1, Math.floor(h * scale))
  const ctx = c.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, h)
  paint(new Pen(ctx, true), o)
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('图片生成失败'))), 'image/png'))
}
