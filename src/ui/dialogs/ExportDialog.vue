<script setup lang="ts">
// 分享 Excel：选时间、选本子，发给老板（微信 / WhatsApp / 邮件）或存到手机。表格里没有 Key。
import { computed, ref } from 'vue'
import { range as recordsIn, state } from '../../data/db'
import { today } from '../../data/model'
import { makeExport } from '../../data/backup'
import { MIME } from '../../io/report'
import { download, shareFile } from '../../io/share'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import RangeChooser from '../components/RangeChooser.vue'
import { useRange, useRangeThisMonth } from '../range'
import { toast } from '../toast'
import { ICON_DOWNLOAD, ICON_SHARE } from '../icons'

const props = defineProps<{ presetCategory: string | null; preset: { from: string | null; to: string | null } | null }>()
const emit = defineEmits<{ close: [] }>()
const range = props.preset ? useRange(props.preset.from, props.preset.to) : useRangeThisMonth()
const cat = ref(props.presetCategory ?? '')
const count = computed(() => recordsIn(range.from, range.to, cat.value || null).length)
const earliest = computed(() => state.records.reduce((m, r) => (r.date < m ? r.date : m), today()))
const busy = ref(false)

async function send() {
  busy.value = true
  try {
    const { name, bytes } = makeExport(range.from, range.to, cat.value || null)
    const res = await shareFile(bytes, name, MIME, name.replace(/\.xlsx$/, ''))
    if (res === 'downloaded') toast('已下载：' + name)
    if (res !== 'cancelled') emit('close')
  } finally {
    busy.value = false
  }
}
function save() {
  const { name, bytes } = makeExport(range.from, range.to, cat.value || null)
  download(new Blob([bytes as BlobPart], { type: MIME }), name)
  toast('已下载：' + name)
  emit('close')
}
</script>
<template>
  <Modal title="分享 Excel 表格" @close="busy || emit('close')">
    <div class="label">时间</div>
    <RangeChooser :range="range" :earliest="earliest" />
    <div class="label">类别</div>
    <div class="row wrap" style="gap: 6px">
      <button class="chip" :class="{ sel: cat === '' }" @click="cat = ''">全部</button>
      <button v-for="c in state.cats" :key="c.name" class="chip" :class="{ sel: cat === c.name }" @click="cat = c.name">{{ c.name }}</button>
    </div>
    <div class="title-s">{{ count === 0 ? '这段时间没有记录（也可以导出空表）' : `共 ${count} 条记录` }}</div>
    <div class="small muted">表格里有：汇总、每日、每个本子一张（跟纸上的清单一样，每天一列）、明细。老板用 Excel、WPS 或手机都能打开。</div>
    <template #actions>
      <button class="btn text" :disabled="busy" @click="emit('close')">取消</button>
      <button class="btn text" :disabled="busy" @click="save"><Icon :path="ICON_DOWNLOAD" :size="18" />存到手机</button>
      <button class="btn" :disabled="busy" @click="send"><Icon :path="ICON_SHARE" :size="18" />发给老板</button>
    </template>
  </Modal>
</template>
