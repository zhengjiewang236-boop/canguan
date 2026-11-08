import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' —— 放在 GitHub Pages 的子目录（/仓库名/）下也能用
export default defineConfig({
  base: './',
  // 老一点的 iPhone（iOS 14 起）也能用
  build: { target: ['es2020', 'safari14', 'chrome90'] },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
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
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // DeepSeek 的请求不缓存
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
})
