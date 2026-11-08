<script setup lang="ts">
// 统计图片预览：存到手机 / 发给老板
import { onBeforeUnmount, ref } from 'vue'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import { download, shareFile } from '../../io/share'
import { toast } from '../toast'
import { ICON_DOWNLOAD, ICON_SHARE } from '../icons'
const props = defineProps<{ blob: Blob; name: string }>()
const emit = defineEmits<{ close: [] }>()
const url = URL.createObjectURL(props.blob)
onBeforeUnmount(() => URL.revokeObjectURL(url))
const busy = ref(false)
async function send() {
  busy.value = true
  try {
    const r = await shareFile(props.blob, props.name, 'image/png', '进货统计')
    if (r === 'downloaded') toast('图片已下载')
  } finally {
    busy.value = false
  }
}
function save() {
  download(props.blob, props.name)
  toast('图片已下载（iPhone 上可以长按图片「存储到照片」）')
}
</script>
<template>
  <Modal full title="统计图片" @close="emit('close')">
    <img :src="url" alt="统计图片" class="pic" />
    <div class="small muted center" style="padding-top: 6px">也可以长按图片保存</div>
    <template #actions>
      <button class="btn outline" style="flex: 1" :disabled="busy" @click="save"><Icon :path="ICON_DOWNLOAD" :size="18" />存到手机</button>
      <button class="btn" style="flex: 1" :disabled="busy" @click="send"><Icon :path="ICON_SHARE" :size="18" />发给老板</button>
    </template>
  </Modal>
</template>
<style scoped>
.pic {
  width: 100%;
  display: block;
  border: 1px solid var(--outline-variant);
  -webkit-touch-callout: default;
}
</style>
