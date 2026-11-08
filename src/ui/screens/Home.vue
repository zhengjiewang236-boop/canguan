<script setup lang="ts">
import { computed, ref } from 'vue'
import { state, countsOn } from '../../data/db'
import { daysBetween, fromISO, fullDate, today } from '../../data/model'
import { makeBackup, markBackup } from '../../data/backup'
import { MIME } from '../../io/report'
import { shareFile } from '../../io/share'
import AppBar from '../components/AppBar.vue'
import Icon from '../components/Icon.vue'
import { push } from '../nav'
import { appUpdate, catColor, catIconOf, isIOS, isStandalone, isWeChat } from '../common'
import { startRestore } from '../flows'
import { toast } from '../toast'
import { ICON_BACKUP, ICON_CHART, ICON_INSTALL, ICON_RIGHT, ICON_SETTINGS, ICON_CLOSE } from '../icons'

const t = computed(() => {
  void state.version
  return today()
})
const counts = computed(() => countsOn(t.value))
const todayTotal = computed(() => [...counts.value.values()].reduce((a, b) => a + b, 0))
const cats = computed(() => state.cats)
const total = computed(() => state.records.length)

const lastBackup = computed(() => state.prefs.lastBackup)
const sinceDays = computed(() => (lastBackup.value ? daysBetween(lastBackup.value, t.value) : null))
const warn = computed(() => total.value > 0 && (sinceDays.value == null || sinceDays.value >= 7))
const backupText = computed(() => {
  const d = sinceDays.value
  if (d == null) return '还没有备份过'
  if (d === 0) return '上次备份：今天'
  const x = fromISO(lastBackup.value!)
  return `上次备份：${d} 天前（${x.getMonth() + 1}月${x.getDate()}日）`
})

const busy = ref(false)
async function backup() {
  if (busy.value) return
  busy.value = true
  try {
    // 先同步做好文件，马上调分享（iPhone 要求在点按钮的那一下里调）
    const { name, bytes } = makeBackup()
    const res = await shareFile(bytes, name, MIME, '餐馆记账备份')
    if (res !== 'cancelled') {
      await markBackup()
      if (res === 'downloaded') toast('备份文件已下载：' + name)
    }
  } catch (e) {
    toast('备份失败：' + ((e as Error)?.message ?? ''))
  } finally {
    busy.value = false
  }
}

// iPhone 用 Safari 打开（还没加到主屏幕）：提示先加到主屏幕
const hideInstall = ref(false)
try {
  hideInstall.value = localStorage.getItem('hide-install') === '1'
} catch {
  /* 不能存就每次都提示 */
}
const wechat = isWeChat()
const showInstall = computed(() => !wechat && !isStandalone() && !hideInstall.value)
const build = __BUILD__
const ios = isIOS()
function closeInstall() {
  hideInstall.value = true
  try {
    localStorage.setItem('hide-install', '1')
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="screen">
    <AppBar title="餐馆记账">
      <button class="btn text" :disabled="busy" @click="backup">备份数据</button>
      <button class="btn text" @click="startRestore">恢复数据</button>
    </AppBar>
    <div class="content stack">
      <div v-if="wechat" class="wechat">
        <div class="semi">现在是在微信里打开的</div>
        <div class="small">
          在微信里记的数据存在微信里，也不能备份。请点右上角 <b>···</b> →「在浏览器打开」{{ ios ? '（选 Safari）' : '' }}，再加到主屏幕使用。
        </div>
      </div>
      <button v-if="appUpdate.ready" class="update" @click="appUpdate.apply()">
        <div class="grow" style="text-align: left">
          <div class="semi">有新版本了</div>
          <div class="small">点这里更新（数据不会丢）</div>
        </div>
        <Icon :path="ICON_RIGHT" />
      </button>
      <div v-if="showInstall" class="install">
        <Icon :path="ICON_INSTALL" />
        <div class="grow">
          <div class="semi">先把它加到主屏幕</div>
          <div v-if="ios" class="small">
            在 Safari 里点下面的「分享」<b>⎙</b> →「添加到主屏幕」。以后都从主屏幕的「餐馆记账」图标打开，数据存在那里，没网也能用。
          </div>
          <div v-else class="small">在浏览器菜单里点「添加到主屏幕」或「安装应用」。以后都从主屏幕的图标打开，没网也能用。</div>
        </div>
        <button class="icon-btn" aria-label="关掉提示" @click="closeInstall"><Icon :path="ICON_CLOSE" :size="20" /></button>
      </div>

      <div style="padding: 4px">
        <div class="title-s" style="font-size: 17px">{{ fullDate(t) }}</div>
        <div class="muted">{{ todayTotal > 0 ? `今天已经记了 ${todayTotal} 笔` : '今天还没有记录' }}</div>
      </div>

      <div class="grid">
        <button v-for="c in cats" :key="c.name" class="cat" :style="{ background: catColor(c.name) }" @click="push({ name: 'book', cat: c.name })">
          <Icon :path="catIconOf(c.name)" :size="30" />
          <div>
            <div class="cn">{{ c.name }}</div>
            <div class="cs">{{ (counts.get(c.name) ?? 0) > 0 ? `今天 ${counts.get(c.name)} 笔` : '今天还没记' }}</div>
          </div>
        </button>
      </div>

      <button class="stats" @click="push({ name: 'stats' })">
        <Icon :path="ICON_CHART" :size="36" />
        <div class="grow" style="text-align: left">
          <div class="sn">统计分析</div>
          <div class="ss">每种多少箱、多少袋 · 几号进了什么</div>
        </div>
        <Icon :path="ICON_RIGHT" />
      </button>

      <button class="btn outline big block" @click="push({ name: 'settings' })">
        <Icon :path="ICON_SETTINGS" :size="20" />
        设置：本子和里面的东西
      </button>

      <div class="bk" :class="{ warn }">
        <Icon :path="ICON_BACKUP" :size="20" />
        <div>
          <div class="semi" style="font-size: 14px">{{ backupText }}</div>
          <div class="tiny">{{ warn ? '该备份了：点右上角「备份数据」，发到微信或邮箱存着' : '换手机时用右上角「恢复数据」' }}</div>
        </div>
      </div>
      <div class="small muted" style="padding: 4px">填的数字按日期自动保存。发给老板：在「统计分析」里发图片或分享 Excel 表格。</div>
      <div class="tiny muted" style="padding: 0 4px">数据只存在这台手机的这个浏览器里。备份文件跟安卓 App 通用，可以互相恢复。</div>
      <div class="tiny muted center" style="opacity: 0.7">网页版 · {{ build }} 更新</div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.cat {
  height: 136px;
  border-radius: 20px;
  color: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: left;
}
.cat:active,
.stats:active {
  filter: brightness(0.92);
}
.cn {
  font-size: 30px;
  font-weight: 700;
  line-height: 34px;
  word-break: break-all;
}
.cs {
  font-size: 14px;
  opacity: 0.88;
}
.stats {
  height: 100px;
  border-radius: 20px;
  background: var(--stats);
  color: #fff;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
}
.sn {
  font-size: 26px;
  font-weight: 700;
}
.ss {
  font-size: 14px;
  opacity: 0.88;
}
.bk {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--s-high);
  color: var(--on-surface-variant);
}
.bk.warn {
  background: var(--error-container);
  color: var(--on-error-container);
}
.wechat {
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--error-container);
  color: var(--on-error-container);
}
.update {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--primary);
  color: var(--on-primary);
}
.install {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 6px 12px 14px;
  border-radius: 14px;
  background: var(--primary-container);
  color: var(--on-primary-container);
}
</style>
