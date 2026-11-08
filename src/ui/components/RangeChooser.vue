<script setup lang="ts">
// 今天 / 本周 / 本月 / 全部
// ‹  从 11月1日  至  11月30日  ›   —— 点按钮日期跟着变；点日期可以直接改；箭头往前往后翻。
import { computed } from 'vue'
import { RANGE_LABEL, fromISO, maxDate, minDate, today, weekShort } from '../../data/model'
import type { DateRange } from '../range'
import { PRESETS } from '../range'
import Icon from './Icon.vue'
import DatePick from './DatePick.vue'
import { ICON_LEFT, ICON_RIGHT } from '../icons'

const props = defineProps<{ range: DateRange; earliest?: string }>()
const t = today()
const matched = computed(() => props.range.matched(t))
const md = (s: string) => {
  const d = fromISO(s)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
const sub = (s: string) => `${s.slice(0, 4)} ${weekShort(s)}`
function pickFrom(d: string) {
  props.range.set(d, maxDate(d, props.range.to ?? t), 'SPAN')
}
function pickTo(d: string) {
  props.range.set(minDate(d, props.range.from ?? props.earliest ?? t), d, 'SPAN')
}
</script>
<template>
  <div class="stack s6">
    <div class="hscroll">
      <button v-for="k in PRESETS" :key="k" class="chip" :class="{ sel: matched === k }" @click="range.choose(k, t)">{{ RANGE_LABEL[k] }}</button>
    </div>
    <div class="rc">
      <button class="icon-btn" aria-label="往前" :disabled="range.all" @click="range.shift(-1)"><Icon :path="ICON_LEFT" /></button>
      <DatePick class="grow box" :value="range.from" :fallback="earliest ?? t" @pick="pickFrom">
        <div class="title-m">{{ range.from ? md(range.from) : '最早' }}</div>
        <div class="small muted">{{ range.from ? sub(range.from) : '点这里选' }}</div>
      </DatePick>
      <span class="muted">至</span>
      <DatePick class="grow box" :value="range.to" :fallback="t" @pick="pickTo">
        <div class="title-m">{{ range.to ? md(range.to) : '今天' }}</div>
        <div class="small muted">{{ range.to ? sub(range.to) : '点这里选' }}</div>
      </DatePick>
      <button class="icon-btn" aria-label="往后" :disabled="range.all" @click="range.shift(1)"><Icon :path="ICON_RIGHT" /></button>
    </div>
  </div>
</template>
<style scoped>
.rc {
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 16px;
  background: var(--s-high);
}
.box {
  text-align: center;
  padding: 6px 0;
}
</style>
