<script setup lang="ts">
// 核对页：认出来的每一样都能改；清空的就不填。点“填进去”才写进这天。
import { computed, reactive, ref } from 'vue'
import type { Item } from '../../data/model'
import { fmtQty, newRec, parseQty, shortDateWeek } from '../../data/model'
import { byDay, insert, setQty, setWeights } from '../../data/db'
import type { Result } from '../../io/recognize'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import DatePick from '../components/DatePick.vue'
import WeighBlock from '../components/WeighBlock.vue'
import WeightDialog from './WeightDialog.vue'
import { ICON_CHECKED, ICON_UNCHECKED } from '../icons'
import { queue } from '../common'
import { toast } from '../toast'

const props = defineProps<{ cat: string; photo: string; result: Result; initialDate: string }>()
const emit = defineEmits<{ close: []; applied: [string] }>()

const keyOf = (it: Item) => String(it.id ?? it.name)
const date = ref(props.initialDate)
const big = ref(false)
const saving = ref(false)
const counts = reactive<Record<string, string>>(Object.fromEntries(props.result.counts.map((c) => [keyOf(c.item), fmtQty(c.qty)])))
const weights = reactive<Record<string, number[]>>(Object.fromEntries(props.result.weights.map((w) => [keyOf(w.item), [...w.values]])))
const others = reactive(props.result.others.map((o) => ({ name: o.name, qty: fmtQty(o.qty), unit: o.unit, on: true })))
const editBox = ref<{ k: string; i: number; item: Item } | null>(null)

const existing = computed(() => byDay(props.cat, date.value))
const oldCount = (it: Item) => existing.value.filter((r) => !r.weigh && !r.taken && r.name === it.name && r.unit === it.unit).reduce((a, r) => a + r.qty, 0)
const oldBoxes = (it: Item) => existing.value.filter((r) => r.weigh && !r.taken && r.name === it.name && r.unit === it.unit)
const sum = (l: number[]) => l.reduce((a, b) => a + b, 0)

const badCount = computed(() => Object.values(counts).some((t) => t.trim() && ((parseQty(t) ?? -1) < 0)))
const badOther = computed(() => others.some((o) => o.on && (parseQty(o.qty) == null || !o.name.trim())))
const toApply = computed(
  () => Object.values(counts).filter((t) => (parseQty(t) ?? 0) > 0).length + Object.values(weights).filter((l) => l.length).length + others.filter((o) => o.on).length,
)
const size = props.result.counts.length + props.result.weights.length + props.result.others.length
const unsure = props.result.counts.filter((c) => !c.sure).length + props.result.weights.filter((w) => !w.sure).length

function paper(values: number[], pc: number | null, pt: number | null, unit: string) {
  if (pc == null && pt == null) return null
  const s = sum(values)
  const countOk = pc == null || pc === values.length
  const totalOk = pt == null || Math.abs(s - pt) < 0.0005
  const ok = countOk && totalOk
  const paperText = [pc != null ? `${pc} 箱` : null, pt != null ? `${fmtQty(pt)} ${unit}` : null].filter(Boolean).join('，')
  return {
    ok,
    title: ok ? `✓ 跟纸上写的合计对得上（${paperText}）` : '⚠ 跟纸上写的合计对不上',
    sub: ok ? '' : `纸上写的：${paperText}；识别的：${values.length} 箱，${fmtQty(s)} ${unit}` + (!totalOk ? `（差 ${fmtQty(Math.abs(s - pt!))}）` : '') + '。请放大照片，一箱一箱对一下。',
  }
}

async function apply() {
  saving.value = true
  const d = date.value
  const cs = props.result.counts.flatMap((l) => {
    const q = parseQty(counts[keyOf(l.item)] ?? '')
    return q != null && q > 0 ? [[l.item, q] as const] : []
  })
  const ws = props.result.weights.flatMap((l) => {
    const vs = weights[keyOf(l.item)] ?? []
    return vs.length ? [[l.item, vs] as const] : []
  })
  const os = others.filter((o) => o.on).flatMap((o) => {
    const q = parseQty(o.qty)
    return q != null ? [[o.name.trim(), q, o.unit.trim() || '个'] as const] : []
  })
  try {
    await queue(async () => {
      for (const [it, q] of cs) await setQty(props.cat, d, it.name, it.unit, q)
      for (const [it, vs] of ws) await setWeights(props.cat, d, it.name, it.unit, vs)
      for (const [n, q, u] of os) await insert(newRec({ date: d, category: props.cat, name: n, qty: q, unit: u, note: '拍照识别' }))
    })
    toast(`已填进 ${shortDateWeek(d)}：${cs.length + ws.length + os.length} 样`)
    emit('applied', d)
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <Modal full :title="`核对识别结果 · ${cat}`" @close="emit('close')">
    <img :src="photo" alt="照片" class="photo" :class="{ big }" @click="big = !big" />
    <div class="small muted center" style="padding-top: 4px">{{ big ? '点照片缩小' : '点照片放大，对照着检查' }}</div>

    <div class="card high stack s6" style="margin: 8px 0; padding: 12px">
      <div class="row">
        <span class="grow bold">填到：{{ shortDateWeek(date) }}</span>
        <DatePick :value="date" @pick="date = $event"><span class="btn text">改日期</span></DatePick>
      </div>
      <div v-if="result.date && result.date !== date" class="row">
        <span class="grow small" style="color: var(--secondary)">纸上写的日期像是 {{ shortDateWeek(result.date) }}</span>
        <button class="btn text" @click="date = result.date!">用这天</button>
      </div>
      <div class="small muted">
        <template v-if="size === 0">没有认出数字。可以关掉换一张更清楚的照片再试。</template>
        <template v-else>认出 {{ size }} 样{{ unsure > 0 ? `，其中 ${unsure} 样看不太清（橙色）` : '' }}。对照照片检查，不对的直接改；清空就不填。没认出来的不会动。</template>
      </div>
    </div>

    <div v-for="line in result.counts" :key="'c' + keyOf(line.item)" class="rr" :class="{ unsure: !line.sure }">
      <div class="row">
        <div class="grow">
          <div class="semi">{{ line.item.name }}</div>
          <div v-if="line.item.section || !line.sure" class="small">
            {{ [line.item.section || null, !line.sure ? '看不太清，请核对' : null].filter(Boolean).join(' · ') }}
          </div>
        </div>
        <input
          v-model="counts[keyOf(line.item)]"
          class="qty"
          style="width: 96px"
          :class="{ bad: !!counts[keyOf(line.item)]?.trim() && parseQty(counts[keyOf(line.item)]) == null }"
          inputmode="decimal"
        />
        <span class="muted" style="width: 34px">{{ line.item.unit }}</span>
      </div>
      <div v-if="oldCount(line.item) > 0 && parseQty(counts[keyOf(line.item)] ?? '') !== oldCount(line.item)" class="small" style="color: var(--secondary); padding-top: 4px">
        原来 {{ fmtQty(oldCount(line.item)) }}，会改成新的
      </div>
    </div>

    <div v-for="line in result.weights" :key="'w' + keyOf(line.item)" class="wbox">
      <WeighBlock
        :name="line.item.name"
        :unit="line.item.unit"
        :hint="line.sure ? '点某一箱可以改或删，漏了的在下面加' : '有的看不太清，请对照照片检查'"
        :values="weights[keyOf(line.item)] ?? []"
        :divider="false"
        @add="(w) => (weights[keyOf(line.item)] = [...(weights[keyOf(line.item)] ?? []), w])"
        @entry="(i) => (editBox = { k: keyOf(line.item), i, item: line.item })"
      >
        <template v-for="p in [paper(weights[keyOf(line.item)] ?? [], line.paperCount, line.paperTotal, line.item.unit)]" :key="1">
          <div v-if="p" class="pc" :class="{ ok: p.ok }">
            <div class="semi">{{ p.title }}</div>
            <div v-if="p.sub" class="small">{{ p.sub }}</div>
          </div>
        </template>
        <div v-if="oldBoxes(line.item).length" class="small" style="color: var(--secondary)">
          这天原来有 {{ oldBoxes(line.item).length }} 箱（共 {{ fmtQty(sum(oldBoxes(line.item).map((r) => r.qty))) }} {{ line.item.unit }}），会换成识别的
        </div>
      </WeighBlock>
    </div>

    <template v-if="others.length">
      <div class="title-s" style="padding: 12px 0 4px">清单里没有的（勾上的会作为临时的一样加进这天）</div>
      <div v-for="(o, i) in others" :key="i" class="row" style="padding: 4px 0; gap: 6px">
        <button class="icon-btn" style="width: 36px" @click="o.on = !o.on">
          <Icon :path="o.on ? ICON_CHECKED : ICON_UNCHECKED" :style="{ color: o.on ? 'var(--primary)' : 'var(--on-surface-variant)' }" />
        </button>
        <input v-model="o.name" class="input" style="flex: 1.4; min-width: 0" placeholder="品名" />
        <input v-model="o.qty" class="input" :class="{ bad: o.on && parseQty(o.qty) == null }" style="flex: 0.8; min-width: 0" inputmode="decimal" placeholder="数量" />
        <input v-model="o.unit" class="input" style="flex: 0.7; min-width: 0" maxlength="4" placeholder="单位" />
      </div>
    </template>

    <template #actions>
      <button class="btn outline" style="flex: 1" @click="emit('close')">不要了</button>
      <button class="btn" style="flex: 1.6" :disabled="saving || toApply === 0 || badCount || badOther" @click="apply">
        {{ toApply > 0 ? `填进去（${toApply} 样）` : '没有要填的' }}
      </button>
    </template>
  </Modal>
  <WeightDialog
    v-if="editBox"
    :title="`${editBox.item.name} · 第 ${editBox.i + 1} 箱`"
    :value="weights[editBox.k][editBox.i]"
    :unit="editBox.item.unit"
    @close="editBox = null"
    @save="(w) => { weights[editBox!.k] = weights[editBox!.k].map((v, j) => (j === editBox!.i ? w : v)); editBox = null }"
    @remove="() => { weights[editBox!.k] = weights[editBox!.k].filter((_, j) => j !== editBox!.i); editBox = null }"
  />
</template>
<style scoped>
.photo {
  width: 100%;
  height: 170px;
  object-fit: cover;
  border-radius: 12px;
  background: #000;
  display: block;
}
.photo.big {
  height: auto;
  max-height: 75vh;
  object-fit: contain;
}
.rr {
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 12px;
  background: var(--s-low);
}
.rr.unsure {
  background: var(--unsure-bg);
  color: var(--unsure-fg);
}
.wbox {
  margin: 4px 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--s-low);
}
.pc {
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--unsure-bg);
  color: var(--unsure-fg);
}
.pc.ok {
  background: var(--primary-container);
  color: var(--on-primary-container);
}
</style>
