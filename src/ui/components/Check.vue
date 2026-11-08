<script setup lang="ts">
import Icon from './Icon.vue'
import { ICON_CHECKED, ICON_UNCHECKED } from '../icons'
defineProps<{ checked: boolean; title: string; sub?: string }>()
const emit = defineEmits<{ toggle: [] }>()
</script>
<template>
  <button class="check-row" @click="emit('toggle')">
    <Icon :path="checked ? ICON_CHECKED : ICON_UNCHECKED" :style="{ color: checked ? 'var(--primary)' : 'var(--on-surface-variant)' }" />
    <div class="grow">
      <div class="semi">{{ title }}</div>
      <div v-if="sub" class="small muted">{{ sub }}</div>
    </div>
  </button>
</template>
