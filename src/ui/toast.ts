import { reactive } from 'vue'

export const toastState = reactive({ msg: '', action: '', id: 0 })
let onAction: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | undefined

/** 底部的小提示；带 action 的（比如“撤销”）多停一会儿 */
export function toast(msg: string, action?: { label: string; run: () => void }) {
  clearTimeout(timer)
  toastState.msg = msg
  toastState.action = action?.label ?? ''
  toastState.id++
  onAction = action?.run ?? null
  timer = setTimeout(() => (toastState.msg = ''), action ? 6000 : 2600)
}
export function runToastAction() {
  const f = onAction
  onAction = null
  toastState.msg = ''
  f?.()
}
