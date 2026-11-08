// 页面切换：一个页面栈，跟浏览器的“返回”连在一起。
// 安卓手机按返回键：先关掉打开的对话框，再回到上一页（跟安卓 App 一样）。
import { reactive } from 'vue'

export type Screen = (
  | { name: 'home' }
  | { name: 'book'; cat: string }
  | { name: 'stats' }
  | { name: 'settings'; cat?: string }
  | { name: 'cats' }
  | { name: 'ai' }
) & { uid?: number }

export const nav = reactive({ stack: [{ name: 'home', uid: 0 }] as Screen[] })
/** 本子改名了：打开着的页面跟着改 */
export const catRename = reactive({ n: 0, from: '', to: '' })

let seq = 0
/** 每一层离开时滚到哪儿了，回来时恢复 */
const scrolls: number[] = []

interface ModalEntry {
  close: () => void
  locked: boolean
}
const modals: ModalEntry[] = []

// 对 history 的操作排队做：history.back() 是异步的，要等它回来再 pushState
let chain: Promise<void> = Promise.resolve()
function enqueue(fn: () => void | Promise<void>) {
  chain = chain.then(fn, fn).catch(() => {})
}
let expecting = 0
const waiters: (() => void)[] = []
/** 自己调的返回（关对话框时把多出来的那一层去掉），不当作用户按了返回 */
function selfBack(): Promise<void> {
  return new Promise((resolve) => {
    expecting++
    waiters.push(resolve)
    history.back()
    // 万一浏览器没触发 popstate（比如已经在第一层），别卡住
    setTimeout(() => {
      const i = waiters.indexOf(resolve)
      if (i >= 0) {
        waiters.splice(i, 1)
        expecting = Math.max(0, expecting - 1)
        resolve()
      }
    }, 600)
  })
}
const stateNow = () => ({ depth: nav.stack.length, modals: modals.length })

export const current = () => nav.stack[nav.stack.length - 1]

export function push(s: Screen) {
  scrolls[nav.stack.length - 1] = window.scrollY
  nav.stack.push({ ...s, uid: ++seq })
  const st = stateNow()
  enqueue(() => history.pushState(st, ''))
  window.scrollTo(0, 0)
}

export function back() {
  if (nav.stack.length > 1) enqueue(() => history.back())
}

/** 对话框打开时调；返回的函数在对话框关掉时调 */
export function openModal(close: () => void, locked = false): () => void {
  const entry: ModalEntry = { close, locked }
  modals.push(entry)
  const st = stateNow()
  let pushed = false
  let cancelled = false
  enqueue(() => {
    if (cancelled) return
    history.pushState(st, '')
    pushed = true
  })
  return () => {
    const i = modals.indexOf(entry)
    if (i < 0) return // 已经被返回键关掉了
    modals.splice(i, 1)
    if (!pushed) cancelled = true
    enqueue(() => {
      if (pushed) return selfBack()
    })
  }
}

export function renameCat(from: string, to: string) {
  if (from === to) return
  for (const s of nav.stack) if ((s.name === 'book' || s.name === 'settings') && s.cat === from) s.cat = to
  catRename.from = from
  catRename.to = to
  catRename.n++
}

export function initNav() {
  history.replaceState({ depth: 1, modals: 0 }, '')
  window.addEventListener('popstate', (e) => {
    if (expecting > 0) {
      expecting--
      waiters.shift()?.()
      return
    }
    const depth = Math.max(1, (e.state?.depth as number | undefined) ?? 1)
    const m = (e.state?.modals as number | undefined) ?? 0
    // 先关对话框
    while (modals.length > m) {
      const top = modals[modals.length - 1]
      if (top.locked) {
        // 正在识别之类的，不能用返回键关：把这一层补回去
        history.pushState(stateNow(), '')
        return
      }
      modals.pop()
      top.close()
    }
    if (nav.stack.length > depth) {
      while (nav.stack.length > depth) nav.stack.pop()
      const y = scrolls[nav.stack.length - 1] ?? 0
      requestAnimationFrame(() => window.scrollTo(0, y))
    }
  })
}
