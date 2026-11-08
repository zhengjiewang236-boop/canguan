<script setup lang="ts">
import Icon from './Icon.vue'
import { ICON_BACK } from '../icons'
defineProps<{ title?: string; back?: boolean }>()
const emit = defineEmits<{ back: [] }>()
</script>
<template>
  <header class="bar">
    <button v-if="back" class="icon-btn" aria-label="返回" @click="emit('back')"><Icon :path="ICON_BACK" /></button>
    <div class="t grow">
      <slot name="title">{{ title }}</slot>
    </div>
    <div class="acts"><slot /></div>
  </header>
</template>
<style scoped>
.bar {
  position: sticky;
  top: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 56px;
  padding: env(safe-area-inset-top) 4px 0 4px;
  background: var(--bg);
}
.t {
  font-size: 20px;
  font-weight: 700;
  padding: 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 10px;
}
.acts {
  display: flex;
  align-items: center;
}
</style>
