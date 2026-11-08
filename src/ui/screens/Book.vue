<script setup lang="ts">
// 一个本子的一天：清单里的东西都列出来，直接填数字（自动保存）。
// 牛肉这种“每箱称重”的，一箱填一个斤数。清单里没有的，可以临时加。
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Item, Rec } from '../../data/model'
import { DEFAULT_UNITS, fmtQty, itemOrder, itemSums, newRec, parseQty, shortDateWeek, takenText, today } from '../../data/model'
import * as db from '../../data/db'
import { state } from '../../data/db'
import AppBar from '../components/AppBar.vue'
import Icon from '../components/Icon.vue'
import DateBar from '../components/DateBar.vue'
import Empty from '../components/Empty.vue'
import WeighBlock from '../components/WeighBlock.vue'
import RecordDialog from '../dialogs/RecordDialog.vue'
import ReduceDialog from '../dialogs/ReduceDialog.vue'
import WeightDialog from '../dialogs/WeightDialog.vue'
import Confirm from '../dialogs/Confirm.vue'
import SearchDialog from '../dialogs/SearchDialog.vue'
import ExportDialog from '../dialogs/ExportDialog.vue'
import PhotoFlow from '../dialogs/PhotoFlow.vue'
import { back, push } from '../nav'
import { catColor, queue } from '../common'
import { toast } from '../toast'
import { ICON_ADD, ICON_CAMERA, ICON_REMOVE, ICON_SEARCH, ICON_SETTINGS, ICON_SHARE } from '../icons'

const props = defineProps<{ cat: string }>()
const color = computed(() => catColor(props.cat))
const date = ref(today())

const keyOf = (name: string, unit: string) => `${name}\u0001${unit}`
const ik = (it: Item) => keyOf(it.name, it.unit)

const list = computed(() => db.itemsOf(props.cat))
const day = computed(() => db.byDay(props.cat, date.value))
const hints = computed(() => db.nameHints(props.cat))
const units = computed(() => [...DEFAULT_UNITS, ...db.usedUnits().filter((u) => !DEFAULT_UNITS.includes(u))])
const reasons = computed(() => db.parties())
const countKeys = computed(() => new Set(list.value.filter((i) => !i.weigh).map(ik)))
const weighKeys = computed(() => new Set(list.value.filter((i) => i.weigh).map(ik)))

// 填数量的格子：换日期或清单变了才重新读；打字时不打断
const form = reactive<Record<string, string>>({})
const formReload = ref(0)
function loadForm() {
  for (const k of Object.keys(form)) delete form[k]
  const sums = new Map<string, number>()
  for (const r of db.byDay(props.cat, date.value)) {
    const k = keyOf(r.name, r.unit)
    if (r.weigh || !countKeys.value.has(k)) continue
    sums.set(k, (sums.get(k) ?? 0) + (r.taken ? -r.qty : r.qty))
  }
  // 格子里是这天实际的：进的减去减掉的（可以是负数）
  for (const [k, v] of sums) if (v !== 0) form[k] = fmtQty(v)
}
watch([date, () => [...countKeys.value].join('|'), formReload], loadForm, { immediate: true })

const group = (l: Rec[]) => {
  const m = new Map<string, Rec[]>()
  for (const r of l) m.set(keyOf(r.name, r.unit), [...(m.get(keyOf(r.name, r.unit)) ?? []), r])
  return m
}
const boxes = computed(() => group(day.value.filter((r) => r.weigh && !r.taken && weighKeys.value.has(keyOf(r.name, r.unit)))))
const takenBoxes = computed(() => group(day.value.filter((r) => r.weigh && r.taken && weighKeys.value.has(keyOf(r.name, r.unit)))))
const takenCounts = computed(() => new Map(day.value.filter((r) => !r.weigh && r.taken).map((r) => [keyOf(r.name, r.unit), r])))
const others = computed(() =>
  day.value.filter((r) => {
    const k = keyOf(r.name, r.unit)
    return !r.taken && (r.weigh ? !weighKeys.value.has(k) : !countKeys.value.has(k))
  }),
)

const onlyFilled = ref(false)
function isFilled(it: Item) {
  if (it.weigh) return (boxes.value.get(ik(it))?.length ?? 0) > 0 || (takenBoxes.value.get(ik(it))?.length ?? 0) > 0
  return (parseQty(form[ik(it)] ?? '') ?? 0) !== 0
}
const filledCount = computed(() => list.value.filter(isFilled).length + others.value.length)
const shown = computed(() => (onlyFilled.value ? list.value.filter(isFilled) : list.value))
const sections = computed(() => {
  const m = new Map<string, Item[]>()
  for (const it of shown.value) m.set(it.section, [...(m.get(it.section) ?? []), it])
  return [...m.entries()]
})
const sectionTitles = computed(() => [...new Set(list.value.map((i) => i.section))])
const hasSections = computed(() => sectionTitles.value.some((t) => t))
const sectionCount = (t: string) => `${list.value.filter((i) => i.section === t && isFilled(i)).length} / ${list.value.filter((i) => i.section === t).length}`

// ---------- 写数据库 ----------
const reload = () => formReload.value++

// 变成负数时问原因；negDraft = 刚打成负数、还没问原因的那一样（停一下再问，免得打 “-20” 打到一半就弹出来）
interface ReduceReq {
  item: Item
  presetQty: number | null
  initial: Rec | null
}
const reduce = ref<ReduceReq | null>(null)
const negDraft = ref<Item | null>(null)
let negTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => (negDraft.value ? form[ik(negDraft.value)] : null),
  () => {
    clearTimeout(negTimer)
    const it = negDraft.value
    if (!it) return
    negTimer = setTimeout(() => {
      const v = parseQty(form[ik(it)] ?? '')
      if (v != null && v < 0 && !takenCounts.value.get(ik(it))) reduce.value = { item: it, presetQty: -v, initial: null }
      negDraft.value = null
    }, 900)
  },
)
onBeforeUnmount(() => clearTimeout(negTimer))

function setQty(it: Item, text: string) {
  form[ik(it)] = text
  const q = text.trim() === '' ? 0 : parseQty(text)
  if (q == null) return
  const d = date.value
  if (q >= 0) {
    negDraft.value = null
    // 正数（或清空）：这天就是进了这么多，之前写的“减掉”不要了
    queue(async () => {
      await db.setQty(props.cat, d, it.name, it.unit, q)
      await db.setTaken(props.cat, d, it.name, it.unit, 0, '', '')
    })
  } else {
    const had = takenCounts.value.get(ik(it))
    if (had) {
      // 已经写过原因：只改数，原因留着
      queue(async () => {
        await db.setQty(props.cat, d, it.name, it.unit, 0)
        await db.setTaken(props.cat, d, it.name, it.unit, -q, had.party, had.note)
      })
    } else {
      negDraft.value = it // 停一下再问原因
    }
  }
}
function stepQty(it: Item, d: number) {
  const v = (parseQty(form[ik(it)] ?? '') ?? 0) + d
  setQty(it, v === 0 ? '' : fmtQty(v))
}
function onInput(it: Item, e: Event) {
  setQty(it, (e.target as HTMLInputElement).value)
}
function nextField(e: KeyboardEvent) {
  const all = [...document.querySelectorAll<HTMLInputElement>('.book-qty')]
  const i = all.indexOf(e.target as HTMLInputElement)
  if (i >= 0 && i + 1 < all.length) all[i + 1].focus()
  else (e.target as HTMLInputElement).blur()
}

async function writeThenReload(fn: () => Promise<void>) {
  await queue(fn)
  reload()
}

function remove(r: Rec) {
  const copy = { ...r }
  queue(() => db.remove(r.id!))
  toast(`已删除：${r.name} ${fmtQty(r.qty)}${r.unit}`, { label: '撤销', run: () => queue(() => db.restore(copy)) })
}

function saveReduce(vs: number[], reason: string, note: string) {
  const req = reduce.value!
  reduce.value = null
  const it = req.item
  const d = req.initial?.date ?? date.value
  writeThenReload(async () => {
    if (it.weigh) {
      if (req.initial) await db.update({ ...req.initial, qty: vs[0], party: reason, note })
      else for (const w of vs) await db.insert(newRec({ date: d, category: props.cat, name: it.name, qty: w, unit: it.unit, weigh: true, taken: true, party: reason, note }))
    } else {
      // 从格子里打的负数：这天就是减掉这么多；从原因那一行改的：进的不动
      if (!req.initial) await db.setQty(props.cat, d, it.name, it.unit, 0)
      await db.setTaken(props.cat, d, it.name, it.unit, vs[0], reason, note)
    }
  })
}
function closeReduce() {
  const req = reduce.value
  reduce.value = null
  // 没保存：格子里的负数不算，恢复成原来的
  if (req && !req.item.weigh && !req.initial) reload()
}
function deleteReduce() {
  const r = reduce.value?.initial
  reduce.value = null
  if (!r) return
  writeThenReload(async () => {
    if (r.weigh) await db.remove(r.id!)
    else await db.setTaken(props.cat, r.date, r.name, r.unit, 0, '', '')
  })
}

// ---------- 临时加的 ----------
const editing = ref<Rec | null>(null)
const isNew = ref(false)
const editKey = ref(0)
function addOther() {
  isNew.value = true
  editing.value = newRec({ date: date.value, category: props.cat, name: '', qty: 0, unit: list.value[list.value.length - 1]?.unit ?? '箱' })
  editKey.value++
}
function editOther(r: Rec) {
  isNew.value = false
  editing.value = { ...r }
  editKey.value++
}
function saveRecord(r: Rec, keepOpen: boolean, addToList: boolean) {
  const wasNew = isNew.value
  const section = hasSections.value ? '特殊' : ''
  queue(async () => {
    if (addToList && !db.itemsOf(props.cat).some((i) => i.name === r.name)) {
      await db.saveItem({ category: props.cat, section, name: r.name, unit: r.unit, hint: '', weigh: false, sort: 0 }, null)
    }
    if (wasNew) await db.insert(r)
    else await db.update(r)
  }).then(reload) // 加进了清单的话，格子里要显示刚记的数
  if (r.date !== date.value) date.value = r.date
  if (!keepOpen) editing.value = null
}
const confirmDelete = ref<Rec | null>(null)
let pressTimer: ReturnType<typeof setTimeout> | undefined
let pressed = false
function pressStart(r: Rec) {
  pressed = false
  pressTimer = setTimeout(() => {
    pressed = true
    confirmDelete.value = r
  }, 550)
}
function pressEnd() {
  clearTimeout(pressTimer)
}
function clickOther(r: Rec) {
  if (!pressed) editOther(r)
}

// ---------- 称重 ----------
const editBox = ref<Rec | null>(null)
function addBox(it: Item, w: number) {
  const d = date.value
  queue(() => db.insert(newRec({ date: d, category: props.cat, name: it.name, qty: w, unit: it.unit, weigh: true })))
}

function saveBox(w: number) {
  const r = editBox.value!
  editBox.value = null
  queue(() => db.update({ ...r, qty: w }))
}
function removeBox() {
  const r = editBox.value!
  editBox.value = null
  remove(r)
}
function removeEditing() {
  const r = editing.value!
  editing.value = null
  remove(r)
}
function confirmOk() {
  const r = confirmDelete.value!
  confirmDelete.value = null
  remove(r)
}

// ---------- 其它 ----------
const showSearch = ref(false)
const showExport = ref(false)
const photo = ref<InstanceType<typeof PhotoFlow>>()
const startPhoto = () => photo.value?.start()
function photoApplied(d: string) {
  date.value = d
  reload()
}

function jump(t: string) {
  const el = document.getElementById('sec-' + encodeURIComponent(t || '-'))
  if (!el) return
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - topH.value, behavior: 'smooth' })
}

// 分区标题贴在上面（在顶栏下面）
const topEl = ref<HTMLElement>()
const topH = ref(56)
let ro: ResizeObserver | undefined
onMounted(() => {
  if (topEl.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(() => (topH.value = topEl.value!.offsetHeight))
    ro.observe(topEl.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())

const daySums = computed(() => itemSums(day.value, itemOrder(list.value)))
const dayTaken = computed(() => day.value.filter((r) => r.taken))
</script>

<template>
  <div class="screen">
    <div ref="topEl" class="book-top">
      <AppBar back @back="back()">
        <template #title>
          <span class="dot" :style="{ background: color }" />
          <span>{{ cat }}</span>
        </template>
        <button class="icon-btn" aria-label="拍照识别" @click="startPhoto"><Icon :path="ICON_CAMERA" /></button>
        <button class="icon-btn" aria-label="查询" @click="showSearch = true"><Icon :path="ICON_SEARCH" /></button>
        <button class="icon-btn" aria-label="导出" @click="showExport = true"><Icon :path="ICON_SHARE" /></button>
        <button class="icon-btn" aria-label="改清单" @click="push({ name: 'settings', cat })"><Icon :path="ICON_SETTINGS" /></button>
      </AppBar>
      <div v-if="hasSections" class="hscroll secs">
        <button v-for="t in sectionTitles" :key="t" class="chip assist" @click="jump(t)">{{ t || '清单' }}</button>
      </div>
    </div>

    <div class="content flush">
      <div class="stack s8" style="padding: 4px 16px 8px">
        <DateBar :date="date" :accent="color" @change="date = $event" />
        <div class="row">
          <span class="grow muted">{{ filledCount > 0 ? `已填 ${filledCount} 项` : '还没填' }}</span>
          <button class="chip assist" @click="startPhoto"><Icon :path="ICON_CAMERA" :size="18" />拍照识别</button>
          <button class="chip" :class="{ sel: onlyFilled }" @click="onlyFilled = !onlyFilled">只看已填</button>
        </div>
      </div>

      <div v-if="!list.length && !others.length" style="padding: 0 24px 24px; text-align: center">
        <Empty title="这个本子的清单还是空的" sub="去设置把要填的东西加进来" />
        <button class="btn" @click="push({ name: 'settings', cat })">打开设置</button>
      </div>

      <template v-for="[title, sectionItems] in sections" :key="title">
        <div v-if="hasSections" :id="'sec-' + encodeURIComponent(title || '-')" class="anchor" />
        <div v-if="hasSections" class="sh sticky" :style="{ background: color, top: topH + 'px' }">
          <span class="grow">{{ title || '清单' }}</span><span class="small semi">{{ sectionCount(title) }}</span>
        </div>
        <template v-for="it in sectionItems" :key="it.id">
          <WeighBlock
            v-if="it.weigh"
            :name="it.name"
            :unit="it.unit"
            :hint="it.hint"
            :values="(boxes.get(ik(it)) ?? []).map((r) => r.qty)"
            :taken="takenBoxes.get(ik(it)) ?? []"
            reducible
            @add="(w) => addBox(it, w)"
            @entry="(i) => (editBox = { ...(boxes.get(ik(it)) ?? [])[i] })"
            @taken-click="(r) => (reduce = { item: it, presetQty: null, initial: { ...r } })"
            @reduce="reduce = { item: it, presetQty: null, initial: null }"
          />
          <div
            v-else
            class="cr"
            :class="{
              filled: (parseQty(form[ik(it)] ?? '') ?? 0) > 0,
              neg: (parseQty(form[ik(it)] ?? '') ?? 0) < 0,
            }"
          >
            <div class="grow">
              <div class="nm">{{ it.name }}</div>
              <button v-if="takenCounts.get(ik(it))" class="reason" @click="reduce = { item: it, presetQty: null, initial: { ...takenCounts.get(ik(it))! } }">
                {{ takenText(takenCounts.get(ik(it))!) }}
              </button>
              <div v-else-if="(parseQty(form[ik(it)] ?? '') ?? 0) < 0" class="small taken">要写原因…</div>
              <div v-else-if="it.hint" class="small" style="color: var(--secondary)">{{ it.hint }}</div>
            </div>
            <button class="icon-btn" aria-label="减 1" @click="stepQty(it, -1)"><Icon :path="ICON_REMOVE" /></button>
            <input
              class="qty book-qty"
              :class="{
                filled: (parseQty(form[ik(it)] ?? '') ?? 0) > 0,
                neg: (parseQty(form[ik(it)] ?? '') ?? 0) < 0,
                bad: !!(form[ik(it)] ?? '').trim() && form[ik(it)] !== '-' && parseQty(form[ik(it)]) == null,
              }"
              style="width: 62px"
              :value="form[ik(it)] ?? ''"
              inputmode="decimal"
              enterkeyhint="next"
              autocomplete="off"
              @input="onInput(it, $event)"
              @keydown.enter.prevent="nextField"
            />
            <button class="icon-btn" aria-label="加 1" @click="stepQty(it, 1)"><Icon :path="ICON_ADD" /></button>
            <span class="unit muted">{{ it.unit }}</span>
          </div>
        </template>
      </template>

      <div class="sh other">
        <span class="grow">临时加的（不在清单里）</span><span v-if="others.length" class="small semi">{{ others.length }}</span>
      </div>
      <button
        v-for="r in others"
        :key="r.id"
        class="or"
        @click="clickOther(r)"
        @touchstart.passive="pressStart(r)"
        @touchend="pressEnd"
        @touchmove.passive="pressEnd"
        @contextmenu.prevent="confirmDelete = r"
      >
        <div class="grow" style="text-align: left">
          <div>{{ r.name }}</div>
          <div v-if="r.note" class="small muted">{{ r.note }}</div>
        </div>
        <span class="semi">{{ fmtQty(r.qty) }} {{ r.unit }}</span>
      </button>
      <div style="padding: 8px 16px">
        <button class="btn outline block" @click="addOther"><Icon :path="ICON_ADD" :size="18" />加一样清单里没有的</button>
      </div>

      <div v-if="day.length" style="padding: 16px">
        <div class="card high stack s8">
          <div class="title-m">这天合计</div>
          <div v-for="s in daySums" :key="s.category + s.name" class="row">
            <span class="grow">{{ s.name }}</span><span class="semi">{{ s.unitsText() }}</span>
          </div>
          <template v-if="dayTaken.length">
            <hr class="divider" />
            <div class="label taken">减掉的</div>
            <div v-for="r in dayTaken" :key="r.id" class="row small">
              <span class="grow">{{ r.name }}</span><span class="semi taken">{{ takenText(r) }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <RecordDialog
      v-if="editing"
      :key="editKey"
      :is-new="isNew"
      :initial="editing"
      :hints="hints.filter((h) => !list.some((i) => i.name === h.name))"
      :units="units"
      :offer-add-to-list="!list.some((i) => i.name === editing!.name)"
      @close="editing = null"
      @save="saveRecord"
      @remove="removeEditing"
    />
    <ReduceDialog
      v-if="reduce"
      :item="reduce.item"
      :reasons="reasons"
      :initial="reduce.initial"
      :preset-qty="reduce.presetQty"
      :can-delete="!!reduce.initial"
      @close="closeReduce"
      @save="saveReduce"
      @remove="deleteReduce"
    />
    <WeightDialog
      v-if="editBox"
      :title="`${editBox.name} · 这一箱`"
      :value="editBox.qty"
      :unit="editBox.unit"
      @close="editBox = null"
      @save="saveBox"
      @remove="removeBox"
    />
    <Confirm
      v-if="confirmDelete"
      title="删除这条？"
      :text="`${shortDateWeek(confirmDelete.date)}　${confirmDelete.name} ${fmtQty(confirmDelete.qty)}${confirmDelete.unit}` + (confirmDelete.note ? `（${confirmDelete.note}）` : '')"
      confirm="删除"
      @close="confirmDelete = null"
      @ok="confirmOk"
    />
    <SearchDialog v-if="showSearch" :cat="cat" @close="showSearch = false" @pick="(d) => ((date = d), (showSearch = false))" />
    <ExportDialog v-if="showExport" :preset-category="cat" :preset="{ from: date, to: date }" @close="showExport = false" />
    <PhotoFlow ref="photo" :cat="cat" :items="list" :date="date" @applied="photoApplied" @open-ai="push({ name: 'ai' })" />
  </div>
</template>

<style scoped>
.book-top {
  position: sticky;
  top: 0;
  z-index: 15;
  background: var(--bg);
}
.book-top :deep(.bar) {
  position: static;
}
.secs {
  padding: 4px 12px 8px;
  gap: 6px;
}
.dot {
  width: 14px;
  height: 14px;
  border-radius: 7px;
  flex-shrink: 0;
}
.sh {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
}
.sh.sticky {
  position: sticky;
  z-index: 5;
}
.anchor {
  height: 0;
}
.sh.other {
  background: var(--outline);
  margin-top: 4px;
}
.cr {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 4px 4px 4px 16px;
  border-bottom: 1px solid var(--ov-soft);
}
.cr.filled {
  background: var(--pc-soft);
}
.cr.neg {
  background: var(--taken-soft);
}
.cr .nm {
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
.or {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ov-soft);
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
</style>
