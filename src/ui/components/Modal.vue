<script setup lang="ts">
// 对话框。full = 整个屏幕（核对页、查询、图片预览）
import { onBeforeUnmount, onMounted } from 'vue'
import Icon from './Icon.vue'
import { ICON_CLOSE } from '../icons'
const props = withDefaults(defineProps<{ title?: string; full?: boolean; dismissable?: boolean }>(), { dismissable: true })
const emit = defineEmits<{ close: [] }>()
function backdrop() {
  if (props.dismissable) emit('close')
}
// 打开时背后的页面不跟着滚
let count = 0
onMounted(() => {
  count = Number(document.body.dataset.modals ?? 0) + 1
  document.body.dataset.modals = String(count)
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  const n = Number(document.body.dataset.modals ?? 1) - 1
  document.body.dataset.modals = String(n)
  if (n <= 0) document.body.style.overflow = ''
})
</script>
<template>
  <Teleport to="body">
    <div v-if="full" class="full">
      <div class="full-head">
        <button class="icon-btn" aria-label="关闭" @click="emit('close')"><Icon :path="ICON_CLOSE" /></button>
        <div class="title-l grow ell"><slot name="title">{{ title }}</slot></div>
        <slot name="head" />
      </div>
      <div class="full-body"><slot /></div>
      <div v-if="$slots.actions" class="full-foot"><slot name="actions" /></div>
    </div>
    <div v-else class="scrim" @click.self="backdrop">
      <div class="dlg" role="dialog">
        <div v-if="title || $slots.title" class="dlg-title"><slot name="title">{{ title }}</slot></div>
        <div class="dlg-body"><slot /></div>
        <div v-if="$slots.actions" class="dlg-actions"><slot name="actions" /></div>
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));
}
.dlg {
  width: 100%;
  max-width: 460px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 26px;
  background: var(--s-high);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.dlg-title {
  padding: 22px 24px 8px;
  font-size: 20px;
  font-weight: 700;
}
.dlg-body {
  padding: 8px 24px 8px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dlg-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 12px 16px 18px;
}
.full {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
}
.full-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  min-height: 56px;
}
.full-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 16px 16px;
}
.full-foot {
  display: flex;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--outline-variant);
}
.ell {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
