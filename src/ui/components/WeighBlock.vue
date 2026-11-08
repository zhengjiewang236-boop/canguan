<script setup lang="ts">
// 每箱称重：一箱填一个斤数，自动算箱数和总斤数。本子页和拍照识别的核对页都用这一块。
import { computed, ref } from 'vue'
import type { Rec } from '../../data/model'
import { fmtQty, parseQty } from '../../data/model'
import Icon from './Icon.vue'
import { ICON_ADD } from '../icons'

const props = withDefaults(
  defineProps<{ name: string; unit: string; hint: string; values: number[]; taken?: Rec[]; reducible?: boolean; divider?: boolean }>(),
  { taken: () => [], reducible: false, divider: true },
)
const emit = defineEmits<{ add: [number]; entry: [number]; takenClick: [Rec]; reduce: [] }>()
const input = ref('')
const err = ref(false)
const boxCount = computed(() => props.values.length - props.taken.length)
const total = computed(() => props.values.reduce((a, b) => a + b, 0) - props.taken.reduce((a, r) => a + r.qty, 0))
const has = computed(() => props.values.length > 0 || props.taken.length > 0)
function add() {
  const w = parseQty(input.value)
  if (w == null || w <= 0) err.value = true
  else {
    emit('add', w)
    input.value = ''
    err.value = false
  }
}
</script>
<template>
  <div class="wb" :class="{ has, sep: divider }">
    <div class="row" style="align-items: flex-start">
      <div class="grow">
        <div class="title-m">{{ name }}</div>
        <div class="small muted">{{ hint || `每箱填一个${unit}数，一个数就是一箱` }}</div>
      </div>
      <div class="right">
        <div class="bc" :style="{ color: boxCount < 0 ? 'var(--taken)' : 'var(--primary)' }">{{ boxCount }} 箱</div>
        <div class="semi">共 {{ fmtQty(total) }} {{ unit }}</div>
        <div v-if="taken.length" class="small taken">（进{{ values.length }}箱，减掉{{ taken.length }}箱）</div>
      </div>
    </div>
    <slot />
    <div v-if="has" class="row wrap" style="gap: 6px">
      <button v-for="r in taken" :key="'t' + r.id" class="box-chip t" @click="emit('takenClick', r)">−1箱 {{ fmtQty(r.qty) }} · {{ r.party }}</button>
      <button v-for="(v, i) in values" :key="i" class="box-chip" @click="emit('entry', i)">{{ i + 1 }}箱 {{ fmtQty(v) }}</button>
    </div>
    <div class="row">
      <input
        v-model="input"
        class="qty grow"
        :class="{ bad: err }"
        inputmode="decimal"
        enterkeyhint="done"
        autocomplete="off"
        :placeholder="`这一箱多少${unit}`"
        @input="err = false"
        @keydown.enter.prevent="add"
      />
      <button class="btn tonal" @click="add"><Icon :path="ICON_ADD" :size="18" />加一箱</button>
      <button v-if="reducible" class="btn taken-outline" @click="emit('reduce')">减一箱</button>
    </div>
  </div>
</template>
<style scoped>
.wb {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
}
.wb.sep {
  border-bottom: 1px solid var(--ov-soft);
}
.wb.has {
  background: var(--pc-soft);
}
.bc {
  font-size: 22px;
  font-weight: 700;
}
</style>
