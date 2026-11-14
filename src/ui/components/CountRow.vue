<script setup lang="ts">
// 清单里“填数量”的一行：品名 −  [数]  + 单位。本子页和预览都用这一行。
import { computed } from 'vue'
import type { Item, Rec } from '../../data/model'
import { parseQty, takenText } from '../../data/model'
import Icon from './Icon.vue'
import { ICON_ADD, ICON_REMOVE } from '../icons'

const props = defineProps<{ item: Item; text: string; taken?: Rec; inputClass?: string; inputId?: string }>()
const emit = defineEmits<{ input: [string]; step: [number]; next: [KeyboardEvent]; reason: [] }>()
const v = computed(() => parseQty(props.text) ?? 0)
const bad = computed(() => !!props.text.trim() && props.text !== '-' && parseQty(props.text) == null)
</script>
<template>
  <div class="cr" :class="{ filled: v > 0, neg: v < 0 }">
    <div class="grow">
      <div class="nm">{{ item.name }}</div>
      <button v-if="taken" class="reason" @click="emit('reason')">{{ takenText(taken) }}</button>
      <div v-else-if="v < 0" class="small taken">要写原因…</div>
      <div v-else-if="item.hint" class="small" style="color: var(--secondary)">{{ item.hint }}</div>
    </div>
    <button class="icon-btn" aria-label="减 1" @click="emit('step', -1)"><Icon :path="ICON_REMOVE" /></button>
    <input
      :id="inputId"
      class="qty"
      :class="[inputClass, { filled: v > 0, neg: v < 0, bad }]"
      style="width: 62px"
      :value="text"
      inputmode="decimal"
      enterkeyhint="next"
      autocomplete="off"
      @input="emit('input', ($event.target as HTMLInputElement).value)"
      @keydown.enter.prevent="emit('next', $event)"
    />
    <button class="icon-btn" aria-label="加 1" @click="emit('step', 1)"><Icon :path="ICON_ADD" /></button>
    <span class="unit muted">{{ item.unit }}</span>
  </div>
</template>
<style scoped>
.cr {
  display: flex;
  align-items: center;
  padding: 4px 4px 4px 16px;
  border-bottom: 1px solid var(--ov-soft);
}
.cr.filled {
  background: var(--pc-soft);
}
.cr.neg {
  background: var(--taken-soft);
}
.nm {
  font-size: 17px;
}
.cr.filled .nm,
.cr.neg .nm {
  font-weight: 700;
}
.reason {
  font-size: 13px;
  font-weight: 600;
  color: var(--taken);
  text-align: left;
  padding: 2px 0;
}
.unit {
  width: 34px;
  padding-left: 2px;
  font-size: 16px;
}
</style>
