/// <reference lib="webworker" />
// Service worker：离线缓存 + 安卓上“分享到 餐馆记账”（把备份文件分享过来就能恢复）
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// 有新版本时，页面上点了“更新”才换
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

/** 分享过来的文件先放这里，页面打开后取走 */
export const SHARE_CACHE = 'shared-file'

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'POST' || !url.pathname.endsWith('/share-target')) return
  e.respondWith(
    (async () => {
      try {
        const form = await e.request.formData()
        const f = form.getAll('file').find((x): x is File => x instanceof File)
        if (f) {
          const cache = await caches.open(SHARE_CACHE)
          await cache.put('file', new Response(f, { headers: { 'x-name': encodeURIComponent(f.name || '备份.xlsx'), 'content-type': f.type || 'application/octet-stream' } }))
        }
      } catch {
        /* 读不了就当没分享 */
      }
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303)
    })(),
  )
})
