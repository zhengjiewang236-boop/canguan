import { createApp } from 'vue'
import App from './App.vue'
import './ui/style.css'
import { initDb } from './data/db'
import { initNav } from './ui/nav'
import { appUpdate } from './ui/common'

async function start() {
  initNav()
  try {
    await initDb()
  } catch (e) {
    document.getElementById('app')!.innerHTML =
      '<div style="padding:24px;font-size:17px;line-height:1.6">打不开手机里的数据（浏览器不让存数据）。<br>如果是 iPhone 的“无痕浏览”，请换成普通模式；或者从主屏幕的图标打开。<br><small>' +
      String((e as Error)?.message ?? e) +
      '</small></div>'
    return
  }
  createApp(App).mount('#app')
}
start()

// 离线也能用：注册 service worker。有新版本时首页提示「点这里更新」
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        appUpdate.ready = true
        appUpdate.apply = () => update(true)
      },
    })
    // 一直开着不关的话，每小时看一次有没有新版本
    setInterval(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()), 60 * 60 * 1000)
  })
}
