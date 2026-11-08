<script setup lang="ts">
// 临时加一样（清单里没有的）/ 修改一条
import { computed, nextTick, onMounted, ref } from 'vue'
import type { Rec } from '../../data/model'
import { fmtQty, parseQty, relativeDay, shortDateWeek } from '../../data/model'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import Check from '../components/Check.vue'
import DatePick from '../components/DatePick.vue'
import { ICON_ADD, ICON_DELETE, ICON_EVENT, ICON_REMOVE } from '../icons'

const props = defineProps<{ isNew: boolean; initial: Rec; hints: { name: string; unit: string }[]; units: string[]; offerAddToList: boolean }>()
const emit = defineEmits<{ save: [rec: Rec, keepOpen: boolean, addToList: boolean]; remove: []; close: [] }>()

const name = ref(props.initial.name)
const qty = ref(props.isNew ? '' : fmtQty(props.initial.qty))
const unit = ref(props.initial.unit)
const note = ref(props.initial.note)
const date = ref(props.initial.date)
const addToList = ref(props.isNew)
const unitList = ref(props.initial.unit.trim() && !props.units.includes(props.initial.unit) ? [...props.units, props.initial.unit] : [...props.units])
const addingUnit = ref(false)
const newUnit = ref('')
const err = ref('')
const lastSaved = ref('')
const nameEl = ref<HTMLInputElement>()

onMounted(() => {
  if (props.isNew) setTimeout(() => nameEl.value?.focus(), 150)
})
function useUnit(u: string) {
  if (!unitList.value.includes(u)) unitList.value = [...unitList.value, u]
  unit.value = u
}
function onName() {
  err.value = ''
  const h = props.hints.find((x) => x.name === name.value.trim())
  if (h && !qty.value) useUnit(h.unit)
}
const shownHints = computed(() => {
  const t = name.value.trim()
  return (t ? props.hints.filter((h) => h.name.includes(t) && h.name !== t) : props.hints).slice(0, 10)
})
function build(): Rec | null {
  const n = name.value.trim()
  const q = parseQty(qty.value)
  if (!n) err.value = '请填写品名'
  else if (q == null || q <= 0) err.value = '请填写数量（大于 0 的数字）'
  else if (!unit.value.trim()) err.value = '请选择单位'
  else return { ...props.initial, name: n, qty: q, unit: unit.value.trim(), note: note.value.trim(), date: date.value }
  return null
}
function save() {
  const r = build()
  if (r) emit('save', r, false, props.offerAddToList && addToList.value)
}
async function saveMore() {
  const r = build()
  if (!r) return
  emit('save', r, true, props.offerAddToList && addToList.value)
  lastSaved.value = `${r.name} ${fmtQty(r.qty)}${r.unit}`
  name.value = ''
  qty.value = ''
  note.value = ''
  await nextTick()
  nameEl.value?.focus()
}
function addUnit() {
  const u = newUnit.value.trim()
  if (u) useUnit(u)
  newUnit.value = ''
  addingUnit.value = false
}
const step = (d: number) => {
  const v = (parseQty(qty.value) ?? 0) + d
  qty.value = fmtQty(Math.max(0, v))
}
</script>
<template>
  <Modal :dismissable="false" :title="(isNew ? '加一样 · ' : '修改 · ') + initial.category" @close="emit('close')">
    <div v-if="lastSaved" class="saved">✓ 已保存：{{ lastSaved }}</div>
    <div class="row">
      <Icon :path="ICON_EVENT" :size="20" class="muted" />
      <div class="grow title-s" style="font-weight: 600">{{ shortDateWeek(date) }}{{ relativeDay(date) ? `（${relativeDay(date)}）` : '' }}</div>
      <DatePick :value="date" @pick="date = $event"><span class="btn text">改日期</span></DatePick>
    </div>
    <label class="field">
      <span>品名</span>
      <input ref="nameEl" v-model="name" class="input" enterkeyhint="next" @input="onName" />
    </label>
    <div v-if="shownHints.length" class="row wrap" style="gap: 6px">
      <button v-for="h in shownHints" :key="h.name" class="chip assist" @click="((name = h.name), useUnit(h.unit), (err = ''))">{{ h.name }}</button>
    </div>
    <div class="row">
      <button class="icon-btn tonal" aria-label="减 1" @click="step(-1)"><Icon :path="ICON_REMOVE" /></button>
      <label class="field grow">
        <span>数量</span>
        <input v-model="qty" class="input big-num" inputmode="decimal" @input="err = ''" />
      </label>
      <button class="icon-btn tonal" aria-label="加 1" @click="step(1)"><Icon :path="ICON_ADD" /></button>
    </div>
    <div class="label">单位</div>
    <div class="row wrap" style="gap: 6px">
      <button v-for="u in unitList" :key="u" class="chip" :class="{ sel: unit === u }" style="font-size: 16px" @click="((unit = u), (err = ''))">{{ u }}</button>
      <button class="chip assist" @click="addingUnit = !addingUnit">+ 其他单位</button>
    </div>
    <div v-if="addingUnit" class="row">
      <input v-model="newUnit" class="input grow" maxlength="4" placeholder="新单位，如 盒、瓶" @keydown.enter.prevent="addUnit" />
      <button class="btn text" @click="addUnit">添加</button>
    </div>
    <label class="field">
      <span>备注（可以不填）</span>
      <textarea v-model="note" class="input" rows="2" />
    </label>
    <Check v-if="offerAddToList" :checked="addToList" title="加进清单，以后每天都有" sub="不勾就只记这一次" @toggle="addToList = !addToList" />
    <div v-if="err" class="err">{{ err }}</div>
    <div v-if="!isNew"><button class="btn danger" @click="emit('remove')"><Icon :path="ICON_DELETE" :size="18" />删除这条</button></div>
    <template #actions>
      <button class="btn text" @click="emit('close')">取消</button>
      <button v-if="isNew" class="btn text" @click="saveMore">保存，再加一样</button>
      <button class="btn" @click="save">保存</button>
    </template>
  </Modal>
</template>
<style scoped>
.saved {
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--primary-container);
  color: var(--on-primary-container);
}
</style>
