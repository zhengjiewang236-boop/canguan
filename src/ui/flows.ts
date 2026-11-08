// 全局的几个流程：恢复数据（首页、设置都能打开）
import { reactive } from 'vue'
import type { Preview } from '../io/report'
import { readBackup } from '../data/backup'
import { pickFile } from '../io/share'

export const restoreState = reactive({ preview: null as Preview | null, error: '', busy: false })

const ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream'

export async function startRestore() {
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
