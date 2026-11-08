import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' —— 放在 GitHub Pages 的子目录（/仓库名/）下也能用
// 打包时间，显示在首页最下面，方便看是不是最新版
const BUILD = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(new Date())

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  // 老一点的 iPhone（iOS 14 起）也能用
  build: { target: ['es2020', 'safari14', 'chrome90'] },
  plugins: [
    vue(),
    VitePWA({
      // 有新版本时先提示，点了才刷新（免得正在填的时候页面突然刷新）
      registerType: 'prompt',
      // 自己写的 service worker（多了安卓上“分享到 餐馆记账”）
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'] },
      includeAssets: ['icon-180.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: '餐馆记账',
        short_name: '餐馆记账',
        description: '餐馆进货记账：小本、大本、蔬菜、牛肉，统计、发图片、Excel',
        lang: 'zh-CN',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        background_color: '#F8F6F1',
        theme_color: '#F8F6F1',
        // 安卓：在文件管理器里把备份文件“分享”给 餐馆记账，就能直接恢复（要先加到主屏幕）
        share_target: {
          action: './share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'file',
                accept: ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
              },
            ],
          },
        },
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
})
