// 照片处理：读出来（浏览器会按相机方向自动转正）、缩到合适大小，转成发给 AI 的 JPEG。
import { AiError } from './deepseek'

/** DeepSeek 收到图片后会缩到大约 1300×1300 像素，再大也是白传，只会更慢。 */
export const MAX_PIXELS = 1300 * 1300
export const MAX_SIDE = 2000

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new AiError('打不开这张照片'))
    }
    img.src = url
  })
}

export interface Shrunk {
  /** 给页面上预览用 */
  dataUrl: string
  /** 发给 AI 的（不带 data: 前缀） */
  base64: string
  width: number
  height: number
}

export async function shrink(file: Blob, quality = 0.85): Promise<Shrunk> {
  const img = await loadImage(file)
  const w0 = img.naturalWidth
  const h0 = img.naturalHeight
  if (!w0 || !h0) throw new AiError('打不开这张照片')
  const s = Math.min(1, MAX_SIDE / Math.max(w0, h0), Math.sqrt(MAX_PIXELS / (w0 * h0)))
  const w = Math.max(1, Math.round(w0 * s))
  const h = Math.max(1, Math.round(h0 * s))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const dataUrl = c.toDataURL('image/jpeg', quality)
  return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1), width: w, height: h }
}
