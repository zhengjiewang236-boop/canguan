// 全局的几个流程：恢复数据（首页、设置都能打开）、下载后的说明
import { reactive } from 'vue'
import type { Preview } from '../io/report'
import { readBackup } from '../data/backup'
import { pickFile } from '../io/share'

export const restoreState = reactive({ preview: null as Preview | null, error: '', busy: false, asking: false })

const ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream'

/** 先弹出说明（备份文件要先存到手机），再选文件 */
export function startRestore() {
  restoreState.asking = true
}

/** 在“选择备份文件”按钮的点击里调（手机要求在点击的那一下里打开选文件） */
export async function pickAndRestore() {
  restoreState.asking = false
  const f = await pickFile(ACCEPT)
  if (f) await openRestore(f)
}

export async function openRestore(f: File) {
  restoreState.busy = true
  try {
    restoreState.preview = await readBackup(f)
  } catch (e) {
    const m = (e as Error)?.message ?? ''
    restoreState.error = /[^\x00-\x7f]/.test(m) ? m : '读不了这个文件。请选择本 App（手机版或网页版）备份或导出的 .xlsx 表格。'
  } finally {
    restoreState.busy = false
  }
}

/** 安卓上从文件管理器“分享”给 餐馆记账 的备份文件（service worker 先放在缓存里） */
const SHARE_CACHE = 'shared-file'
export async function checkShared() {
  const params = new URLSearchParams(location.search)
  if (!params.has('shared')) return
  history.replaceState(history.state, '', location.pathname)
  try {
    const cache = await caches.open(SHARE_CACHE)
    const res = await cache.match('file')
    if (!res) return
    await cache.delete('file')
    const name = decodeURIComponent(res.headers.get('x-name') ?? '备份.xlsx')
    const blob = await res.blob()
    await openRestore(new File([blob], name, { type: blob.type }))
  } catch {
    restoreState.error = '没收到分享的文件，请点首页右上角「恢复数据」选文件。'
  }
}

/** 浏览器不让直接分享（安卓上的 Excel），已经下载到手机了：告诉人怎么发 */
export type HelpKind = 'boss' | 'backup' | 'lists'
export const downloadHelp = reactive({ name: '', kind: 'boss' as HelpKind })
export function showDownloadHelp(name: string, kind: HelpKind) {
  downloadHelp.kind = kind
  downloadHelp.name = name
}
