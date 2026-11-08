<script setup lang="ts">
// 减掉（负数）：写减掉多少和原因。牛肉这种每箱称重的，一箱一个数。
import { computed, ref } from 'vue'
import type { Item, Rec } from '../../data/model'
import { fmtQty, parseQty, shortDateWeek } from '../../data/model'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import { ICON_DELETE } from '../icons'

const props = defineProps<{ item: Item; reasons: string[]; initial: Rec | null; presetQty: number | null; canDelete: boolean }>()
const emit = defineEmits<{ save: [values: number[], reason: string, note: string]; remove: []; close: [] }>()
const weigh = props.item.weigh
const reason = ref(props.initial?.party ?? '')
const note = ref(props.initial?.note ?? '')
const q0 = props.presetQty ?? props.initial?.qty
const qty = ref(q0 != null ? fmtQty(q0) : '')
const boxes = ref<number[]>(weigh && props.initial ? [props.initial.qty] : [])
const boxInput = ref('')
const err = ref('')
const abs = (s: string) => {
  const v = parseQty(s)
  return v == null ? null : Math.abs(v)
}
function addBox() {
  const w = abs(boxInput.value)
  if (w == null || w <= 0) err.value = '这一箱的重量写得不对'
  else {
    boxes.value = [...boxes.value, w]
    boxInput.value = ''
    err.value = ''
  }
}
function save() {
  const r = reason.value.trim()
  if (!r) return (err.value = '请写原因，比如“2号店拿走了”')
  if (weigh) {
    const w = abs(boxInput.value)
    const all = [...boxes.value, ...(w != null && w > 0 ? [w] : [])]
    if (!all.length) return (err.value = `请写这一箱多少${props.item.unit}`)
    emit('save', props.initial ? [all[all.length - 1]] : all, r, note.value.trim())
  } else {
    const q = abs(qty.value)
    if (q == null || q <= 0) return (err.value = '请写减掉多少')
    emit('save', [q], r, note.value.trim())
  }
}
const hints = computed(() => {
  const t = reason.value.trim()
  return props.reasons.filter((h) => h !== t && (!t || h.includes(t))).slice(0, 8)
})
</script>
<template>
  <Modal :dismissable="false" @close="emit('close')">
    <template #title>
      <div class="taken bold">{{ item.name }} · 减掉</div>
      <div v-if="initial" class="small" style="font-weight: 400">{{ shortDateWeek(initial.date) }}</div>
    </template>
    <template v-if="weigh">
      <div class="label">{{ initial ? `这一箱多少${item.unit}` : `减掉的每一箱多少${item.unit}（一箱一个数）` }}</div>
      <div v-if="boxes.length" class="row wrap" style="gap: 6px">
        <button v-for="(w, i) in boxes" :key="i" class="box-chip t" @click="boxes = boxes.filter((_, j) => j !== i)">−1箱 {{ fmtQty(w) }}&nbsp;&nbsp;✕</button>
      </div>
      <div class="row">
        <input v-model="boxInput" class="input grow" inputmode="decimal" :placeholder="`这一箱多少${item.unit}`" @input="err = ''" @keydown.enter.prevent="addBox" />
        <button v-if="!initial" class="btn tonal" @click="addBox">再一箱</button>
      </div>
    </template>
    <div v-else class="row">
      <span class="title-m taken" style="font-weight: 500">减掉</span>
      <input v-model="qty" class="input big-num grow" inputmode="decimal" @input="err = ''" />
      <span class="title-m" style="font-weight: 500">{{ item.unit }}</span>
    </div>
    <label class="field">
      <span>原因（比如 2号店拿走了）</span>
      <input v-model="reason" class="input" maxlength="20" @input="err = ''" />
    </label>
    <div v-if="hints.length" class="row wrap" style="gap: 6px">
      <button v-for="h in hints" :key="h" class="chip assist" @click="((reason = h), (err = ''))">{{ h }}</button>
    </div>
    <label class="field">
      <span>备注（可以不填，比如 下周还）</span>
      <textarea v-model="note" class="input" rows="2" />
    </label>
    <div v-if="err" class="err">{{ err }}</div>
    <div v-if="canDelete">
      <button class="btn danger" @click="emit('remove')"><Icon :path="ICON_DELETE" :size="18" />{{ weigh ? '删掉这一箱' : '不减了（删掉）' }}</button>
    </div>
    <template #actions>
      <button class="btn text" @click="emit('close')">取消</button>
      <button class="btn taken-btn" @click="save">保存</button>
    </template>
  </Modal>
</template>
