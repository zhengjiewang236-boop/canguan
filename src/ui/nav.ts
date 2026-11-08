// 页面切换：一个页面栈，跟浏览器的“返回”连在一起（安卓的返回键、iPhone 的侧滑也能返回）
import { reactive } from 'vue'

export type Screen =
  | { name: 'home' }
  | { name: 'book'; cat: string }
  | { name: 'stats' }
  | { name: 'settings'; cat?: string }
  | { name: 'cats' }
  | { name: 'ai' }

export const nav = reactive({ stack: [{ name: 'home' }] as Screen[] })
/** 每一层离开时滚到哪儿了，回来时恢复 */
const scrolls: number[] = []

export const current = () => nav.stack[nav.stack.length - 1]

export function push(s: Screen) {
  scrolls[nav.stack.length - 1] = window.scrollY
  nav.stack.push(s)
  history.pushState({ depth: nav.stack.length }, '')
  window.scrollTo(0, 0)
}

export function back() {
  if (nav.stack.length > 1) history.back()
}

/** 换掉当前页面（不多一层返回） */
export function replace(s: Screen) {
  nav.stack[nav.stack.length - 1] = s
}

export function initNav() {
  history.replaceState({ depth: 1 }, '')
  window.addEventListener('popstate', (e) => {
    const depth = (e.state?.depth as number | undefined) ?? 1
    while (nav.stack.length > Math.max(1, depth)) nav.stack.pop()
    const y = scrolls[nav.stack.length - 1] ?? 0
    requestAnimationFrame(() => window.scrollTo(0, y))
  })
}
