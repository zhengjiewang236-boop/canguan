import { reactive } from 'vue'
import { cssColor } from '../data/model'
import { findCat } from '../data/db'
import { catIcon } from './icons'
import { toast } from './toast'

/** 本子的颜色；已经删掉的本子显示灰色 */
export function catColor(name: string): string {
  const c = findCat(name)
  return c ? cssColor(c.color) : '#8A877F'
}
export const catIconOf = (name: string) => catIcon(findCat(name)?.icon ?? 'box')

/** 颜色加透明度，比如 tint('#2F7D95', 0.16) */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** 写数据库排队，一个一个来（跟安卓版的 Writer 一样） */
let chain: Promise<unknown> = Promise.resolve()
export function queue<T>(fn: () => Promise<T>): Promise<T> {
  const p = chain.then(fn, fn)
  chain = p.catch((e) => {
    // 写不进去（手机空间满了等）：一定要让人知道
    toast('保存失败：' + ((e as Error)?.message || '请再试一次'))
  })
  return p
}

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () =>
  (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches

/** 微信里打开的（数据存在微信里、不能备份） */
export const isWeChat = () => /MicroMessenger/i.test(navigator.userAgent)

/** 有新版本了 */
export const appUpdate = reactive({ ready: false, apply: () => {} })
