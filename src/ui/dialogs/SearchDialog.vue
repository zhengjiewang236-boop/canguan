<script setup lang="ts">
// 查询：输入品名找以前的记录；不输入就列出有记录的日期，点一下跳过去
import { computed, ref } from 'vue'
import { days, search } from '../../data/db'
import { fmtQty, fullDate, itemSums, takenText } from '../../data/model'
import type { Rec } from '../../data/model'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import { ICON_CLOSE, ICON_SEARCH } from '../icons'

const props = defineProps<{ cat: string }>()
const emit = defineEmits<{ pick: [string]; close: [] }>()
const q = ref('')
const dayList = computed(() => days(props.cat))
const results = computed(() => (q.value.trim() ? search(props.cat, q.value.trim()) : []))
const sums = computed(() => itemSums(results.value))
const groups = computed(() => {
  const m = new Map<string, Rec[]>()
  for (const r of results.value) m.set(r.date, [...(m.get(r.date) ?? []), r])
  return [...m.entries()]
})
const amount = (r: Rec) => (r.taken ? takenText(r) : r.weigh ? `1箱 ${fmtQty(r.qty)}${r.unit}` : `${fmtQty(r.qty)} ${r.unit}`)
</script>
<template>
  <Modal full :title="`${cat} · 查询`" @close="emit('close')">
    <div class="sbox">
      <Icon :path="ICON_SEARCH" class="muted" />
      <input v-model="q" class="grow" placeholder="输入品名，例如 纸杯" enterkeyhint="search" />
      <button v-if="q" class="icon-btn" aria-label="清空" @click="q = ''"><Icon :path="ICON_CLOSE" :size="20" /></button>
    </div>
    <div class="stack s8" style="padding-top: 16px">
      <template v-if="!q.trim()">
        <div class="label">{{ dayList.length ? `有记录的日期（共 ${dayList.length} 天），点一下跳过去` : '还没有任何记录' }}</div>
        <button v-for="d in dayList" :key="d.date" class="it" @click="emit('pick', d.date)">
          <span class="grow">{{ fullDate(d.date) }}</span><span class="semi">{{ d.count }} 笔</span>
        </button>
      </template>
      <template v-else>
        <div class="title-s">找到 {{ results.length }} 条</div>
        <div v-for="s in sums" :key="s.name" class="row small">
          <span class="grow">{{ s.name }} 一共</span><span class="bold">{{ s.unitsText() }}</span>
        </div>
        <template v-for="[d, list] in groups" :key="d">
          <div class="label" style="color: var(--primary); padding-top: 6px">{{ fullDate(d) }}</div>
          <button v-for="r in list" :key="r.id" class="it" @click="emit('pick', r.date)">
            <div class="grow">
              <div>{{ r.name }}</div>
              <div v-if="r.note" class="small muted">{{ r.note }}</div>
            </div>
            <span class="semi" :class="{ taken: r.taken }">{{ amount(r) }}</span>
          </button>
        </template>
      </template>
    </div>
  </Modal>
</template>
<style scoped>
.sbox {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 0 12px;
  min-height: 52px;
  border: 1px solid var(--outline);
  border-radius: 12px;
  background: var(--s-lowest);
}
.sbox input {
  border: none;
  outline: none;
  background: transparent;
  min-height: 48px;
}
.it {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--s-low);
}
</style>
