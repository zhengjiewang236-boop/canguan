<script setup lang="ts">
// ‹  2026年11月8日 星期日 · 今天  ›  点中间选日期
import { computed } from 'vue'
import { addDays, fromISO, relativeDay, today, weekFull } from '../../data/model'
import Icon from './Icon.vue'
import DatePick from './DatePick.vue'
import { ICON_LEFT, ICON_RIGHT } from '../icons'
const props = defineProps<{ date: string; accent: string }>()
const emit = defineEmits<{ change: [string] }>()
const t = computed(() => today())
const title = computed(() => {
  const d = fromISO(props.date)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
})
const sub = computed(() => {
  const rel = relativeDay(props.date, t.value)
  return weekFull(props.date) + (rel ? ` · ${rel}` : '  · 点这里选日期')
})
</script>
<template>
  <div class="db">
    <button class="icon-btn" aria-label="前一天" @click="emit('change', addDays(date, -1))"><Icon :path="ICON_LEFT" /></button>
    <DatePick class="grow mid" :value="date" @pick="emit('change', $event)">
      <div class="title-m">{{ title }}</div>
      <div class="small" :style="{ color: date === t ? accent : 'var(--on-surface-variant)' }">{{ sub }}</div>
    </DatePick>
    <button v-if="date !== t" class="btn text" @click="emit('change', t)">回今天</button>
    <button class="icon-btn" aria-label="后一天" @click="emit('change', addDays(date, 1))"><Icon :path="ICON_RIGHT" /></button>
  </div>
</template>
<style scoped>
.db {
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 16px;
  background: var(--s-high);
}
.mid {
  text-align: center;
  padding: 6px 0;
}
</style>
