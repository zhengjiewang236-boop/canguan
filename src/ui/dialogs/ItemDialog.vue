<script setup lang="ts">
// 清单里的一样：加 / 改名 / 改单位 / 换本子 / 填法 / 提示
import { computed, ref } from 'vue'
import type { Item } from '../../data/model'
import { DEFAULT_UNITS } from '../../data/model'
import { state } from '../../data/db'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import { catColor } from '../common'
import { ICON_DELETE, ICON_RADIO_OFF, ICON_RADIO_ON } from '../icons'

const props = defineProps<{ initial: Item; isNew: boolean; all: Item[] }>()
const emit = defineEmits<{ save: [Item]; remove: []; close: [] }>()
const cat = ref(props.initial.category)
const section = ref(props.initial.section)
const newSection = ref('')
const addingSection = ref(false)
const name = ref(props.initial.name)
const unit = ref(props.initial.unit)
const unitList = ref(props.initial.unit.trim() && !DEFAULT_UNITS.includes(props.initial.unit) ? [...DEFAULT_UNITS, props.initial.unit] : [...DEFAULT_UNITS])
const addingUnit = ref(false)
const newUnit = ref('')
const weigh = ref(props.initial.weigh)
const hint = ref(props.initial.hint)
const err = ref('')
const sections = computed(() => [...new Set(props.all.filter((i) => i.category === cat.value).map((i) => i.section).filter((s) => s))])
const sectionChips = computed(() => [...sections.value, ...(section.value && !sections.value.includes(section.value) ? [section.value] : [])])

function pickCat(c: string) {
  if (cat.value === c) return
  cat.value = c
  section.value = ''
  if (c === '牛肉' && props.isNew) {
    weigh.value = true
    unit.value = '斤'
  }
}
function setWeigh(w: boolean) {
  weigh.value = w
  if (w && !['斤', '公斤'].includes(unit.value)) unit.value = '斤'
}
function addSection() {
  if (newSection.value.trim()) section.value = newSection.value.trim()
  newSection.value = ''
  addingSection.value = false
}
function addUnit() {
  const u = newUnit.value.trim()
  if (u) {
    if (!unitList.value.includes(u)) unitList.value = [...unitList.value, u]
    unit.value = u
  }
  newUnit.value = ''
  addingUnit.value = false
}
function save() {
  const n = name.value.trim()
  if (!n) err.value = '请填写品名'
  else if (!unit.value.trim()) err.value = '请选择单位'
  else if (props.all.some((i) => i.category === cat.value && i.name === n && i.id !== props.initial.id)) err.value = `「${cat.value}」里已经有「${n}」了`
  else emit('save', { ...props.initial, category: cat.value, section: section.value.trim(), name: n, unit: unit.value.trim(), hint: hint.value.trim(), weigh: weigh.value })
}
</script>
<template>
  <Modal :dismissable="false" :title="isNew ? '加一样东西' : `修改「${initial.name}」`" @close="emit('close')">
    <div class="label">放在哪个本子</div>
    <div class="row wrap" style="gap: 6px">
      <button
        v-for="c in state.cats"
        :key="c.name"
        class="chip"
        :style="cat === c.name ? { background: catColor(c.name), color: '#fff', borderColor: 'transparent' } : {}"
        @click="pickCat(c.name)"
      >
        {{ c.name }}
      </button>
    </div>
    <template v-if="sections.length || addingSection">
      <div class="label">分区</div>
      <div class="row wrap" style="gap: 6px">
        <button class="chip" :class="{ sel: !section }" @click="section = ''">不分区</button>
        <button v-for="s in sectionChips" :key="s" class="chip" :class="{ sel: section === s }" @click="section = s">{{ s }}</button>
        <button class="chip assist" @click="addingSection = !addingSection">+ 新分区</button>
      </div>
    </template>
    <div v-else><button class="btn text" style="padding: 0" @click="addingSection = true">+ 放进一个分区（可以不用）</button></div>
    <div v-if="addingSection" class="row">
      <input v-model="newSection" class="input grow" maxlength="10" placeholder="分区名，如 饮料" @keydown.enter.prevent="addSection" />
      <button class="btn text" @click="addSection">好</button>
    </div>
    <label class="field">
      <span>品名</span>
      <input v-model="name" class="input" @input="err = ''" />
    </label>
    <div class="label">怎么填</div>
    <button class="check-row" @click="setWeigh(false)">
      <Icon :path="!weigh ? ICON_RADIO_ON : ICON_RADIO_OFF" :style="{ color: !weigh ? 'var(--primary)' : 'var(--on-surface-variant)' }" />
      <div>
        <div class="semi">填数量</div>
        <div class="small muted">几箱、几袋、几包…… 填一个数</div>
      </div>
    </button>
    <button class="check-row" @click="setWeigh(true)">
      <Icon :path="weigh ? ICON_RADIO_ON : ICON_RADIO_OFF" :style="{ color: weigh ? 'var(--primary)' : 'var(--on-surface-variant)' }" />
      <div>
        <div class="semi">每箱称重</div>
        <div class="small muted">一箱填一个斤数，自动算几箱、一共多少斤（牛肉）</div>
      </div>
    </button>
    <div class="label">{{ weigh ? '重量单位' : '单位' }}</div>
    <div class="row wrap" style="gap: 6px">
      <button v-for="u in weigh ? ['斤', '公斤'] : unitList" :key="u" class="chip" :class="{ sel: unit === u }" @click="unit = u">{{ u }}</button>
      <button v-if="!weigh" class="chip assist" @click="addingUnit = !addingUnit">+ 其他单位</button>
    </div>
    <div v-if="addingUnit && !weigh" class="row">
      <input v-model="newUnit" class="input grow" maxlength="4" placeholder="新单位，如 盒、瓶" @keydown.enter.prevent="addUnit" />
      <button class="btn text" @click="addUnit">添加</button>
    </div>
    <label class="field">
      <span>小提示（可以不填，如 最少5包）</span>
      <input v-model="hint" class="input" maxlength="30" />
    </label>
    <div v-if="!isNew && (name.trim() !== initial.name || unit !== initial.unit) && cat === initial.category" class="small" style="color: var(--secondary)">
      改了品名或单位，以前记的「{{ initial.name }}」也会一起改过来。
    </div>
    <div v-if="err" class="err">{{ err }}</div>
    <template v-if="!isNew">
      <hr class="divider" />
      <div><button class="btn danger" @click="emit('remove')"><Icon :path="ICON_DELETE" :size="18" />从清单里删掉</button></div>
    </template>
    <template #actions>
      <button class="btn text" @click="emit('close')">取消</button>
      <button class="btn" @click="save">保存</button>
    </template>
  </Modal>
</template>
