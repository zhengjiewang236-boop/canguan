// 发文件：手机上弹出系统的分享（微信、WhatsApp、邮件、存到“文件”…）；不支持的浏览器就直接下载。
import { MIME } from './report'

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

export function canShareFiles(): boolean {
  try {
    const f = new File([new Uint8Array([0])], 'a.xlsx', { type: MIME })
    return !!navigator.canShare?.({ files: [f] })
  } catch {
    return false
  }
}

/** 注意：iPhone 上要在“点按钮”的那一下里调，不能先等很久再调。 */
export async function shareFile(data: Blob | Uint8Array, name: string, type: string, title = name): Promise<ShareResult> {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type })
  const file = new File([blob], name, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled'
      // 别的错误（比如不让分享这种文件）就改成下载
    }
  }
  download(blob, name)
  return 'downloaded'
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** 选一个文件（恢复数据用） */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    let done = false
    input.onchange = () => {
      done = true
      resolve(input.files?.[0] ?? null)
      input.remove()
    }
    // 用户取消的话有的浏览器不会触发 change，回到页面时当作取消
    window.addEventListener(
      'focus',
      () =>
        setTimeout(() => {
          if (!done) {
            resolve(null)
            input.remove()
          }
        }, 1500),
      { once: true },
    )
    document.body.appendChild(input)
    input.click()
  })
}
