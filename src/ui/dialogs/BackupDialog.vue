<script setup lang="ts">
// 备份数据：默认全部记录，也可以只备份一段时间的。本子、清单、设置（包括 DeepSeek Key）总是带上。
import { computed, ref } from 'vue'
import { range as recordsIn, state } from '../../data/db'
import { today } from '../../data/model'
import { exportSettings, makeBackup, markBackup } from '../../data/backup'
import { MIME } from '../../io/report'
import { download, shareFile } from '../../io/share'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import RangeChooser from '../components/RangeChooser.vue'
import { useRange } from '../range'
import { toast } from '../toast'
import { showDownloadHelp } from '../flows'
import { ICON_DOWNLOAD, ICON_SHARE } from '../icons'

const emit = defineEmits<{ close: [] }>()
const range = useRange(null, null) // 默认“全部”
const count = computed(() => recordsIn(range.from, range.to, null).length)
const total = computed(() => state.records.length)
const earliest = computed(() => state.records.reduce((m, r) => (r.date < m ? r.date : m), today()))
const hasKey = computed(() => exportSettings().length > 0)
const busy = ref(false)

async function done(res: 'shared' | 'downloaded' | 'cancelled', name: string) {
  if (res === 'cancelled') return
  // 首页的“上次备份”只算全部备份
  if (range.all) await markBackup()
  if (res === 'downloaded') showDownloadHelp(name, 'backup')
  emit('close')
}
async function send() {
  busy.value = true
  try {
    // 先同步做好文件，马上调分享（iPhone 要求在点按钮的那一下里调）
    const { name, bytes } = makeBackup(range.from, range.to)
    await done(await shareFile(bytes, name, MIME, '餐馆记账备份'), name)
  } catch (e) {
    toast('备份失败：' + ((e as Error)?.message ?? ''))
  } finally {
    busy.value = false
  }
}
async function save() {
  const { name, bytes } = makeBackup(range.from, range.to)
  download(new Blob([bytes as BlobPart], { type: MIME }), name)
  await done('downloaded', name)
}
</script>
<template>
  <Modal title="备份数据" @close="busy || emit('close')">
    <div class="label">备份哪段时间的记录</div>
    <RangeChooser :range="range" :earliest="earliest" />
    <div class="title-s">{{ range.all ? `全部记录，共 ${total} 条` : `这段时间 ${count} 条记录（全部 ${total} 条）` }}</div>
    <div class="small muted">
      本子、清单（单位、分区、称重）和设置{{ hasKey ? '（包括 DeepSeek Key）' : '' }}总是全部带上。发到自己的微信「文件传输助手」或邮箱存着，换手机时「恢复数据」。
    </div>
    <div v-if="!range.all" class="small" style="color: var(--secondary)">
      只含这段时间的记录。换手机要把以前的都带过去，请选「全部」。首页的“上次备份”只算全部备份。
    </div>
    <div v-if="hasKey" class="small muted">备份里有 Key，只发给自己，不要发给别人。</div>
    <template #actions>
      <button class="btn text" :disabled="busy" @click="emit('close')">取消</button>
      <button class="btn text" :disabled="busy" @click="save"><Icon :path="ICON_DOWNLOAD" :size="18" />存到手机</button>
      <button class="btn" :disabled="busy" @click="send"><Icon :path="ICON_SHARE" :size="18" />发出去</button>
    </template>
  </Modal>
</template>
