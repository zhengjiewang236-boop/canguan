<script setup lang="ts">
// 统计分析：时间段 + 本子 → 按品名（每样多少）/ 按日期（几号进了什么）；减掉的单独列出。发图片、分享 Excel。
import { computed, ref } from 'vue'
import type { ItemSum, Rec } from '../../data/model'
import { daySums, daysBetween, fmtQty, itemOrder, itemSums, rangeLabel, relativeDay, shortDateWeek, takenText, today } from '../../data/model'
import * as db from '../../data/db'
import { state } from '../../data/db'
import { fileName } from '../../io/report'
import { renderStats } from '../../io/statsImage'
import AppBar from '../components/AppBar.vue'
import Icon from '../components/Icon.vue'
import CatTag from '../components/CatTag.vue'
import Empty from '../components/Empty.vue'
import Modal from '../components/Modal.vue'
import RangeChooser from '../components/RangeChooser.vue'
import ExportDialog from '../dialogs/ExportDialog.vue'
import ImagePreview from '../dialogs/ImagePreview.vue'
import { back } from '../nav'
import { useRangeThisMonth } from '../range'
import { catColor } from '../common'
import { RANGE_LABEL } from '../../data/model'
import { ICON_IMAGE, ICON_SHARE } from '../icons'
import { toast } from '../toast'

const t = today()
const range = useRangeThisMonth()
const cat = ref('')
const tab = ref(0)
const records = computed(() => db.range(range.from, range.to, cat.value || null))
const order = computed(() => itemOrder(db.allItems()))
const items = computed(() => itemSums(records.value, order.value, db.catIndex))
const days = computed(() => daySums(records.value, true, order.value, db.catIndex))
const groups = computed(() => {
  const m = new Map<string, ItemSum[]>()
  for (const s of items.value) m.set(s.category, [...(m.get(s.category) ?? []), s])
  return [...m.entries()]
})
/** 一天里按本子分开（小本、大本……不混在一起） */
function byCat(list: ItemSum[]): [string, ItemSum[]][] {
  const m = new Map<string, ItemSum[]>()
  for (const s of list) m.set(s.category, [...(m.get(s.category) ?? []), s])
  return [...m.entries()]
}
const taken = computed(() => records.value.filter((r) => r.taken).sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0)))
const rangeName = computed(() => {
  const k = range.matched(t)
  return k ? RANGE_LABEL[k] : '所选时间'
})
const dayCount = computed(() => (range.from && range.to ? `${daysBetween(range.from, range.to) + 1} 天` : '全部记录'))
const earliest = computed(() => records.value[0]?.date ?? state.records.reduce((m, r) => (r.date < m ? r.date : m), t))

const detail = ref<ItemSum | null>(null)
const detailRecs = computed(() =>
  detail.value ? records.value.filter((r) => r.category === detail.value!.category && r.name === detail.value!.name).sort((a, b) => b.date.localeCompare(a.date)) : [],
)
const amount = (r: Rec) => (r.weigh ? `1箱 ${fmtQty(r.qty)}${r.unit}` : `${fmtQty(r.qty)} ${r.unit}`)

const making = ref(false)
const image = ref<{ blob: Blob; name: string } | null>(null)
async function makeImage() {
  making.value = true
  try {
    const blob = await renderStats({
      records: records.value,
      order: order.value,
      catIndex: db.catIndex,
      colorOf: catColor,
      rangeText: rangeLabel(range.from, range.to),
      catText: cat.value || '全部本子',
      byDay: tab.value === 1,
    })
    const name = fileName(range.from, range.to, cat.value || null, t).replace(/\.xlsx$/, '').replace('餐馆记账_', '进货统计_') + '.png'
    image.value = { blob, name }
  } catch (e) {
    toast('图片生成失败：' + ((e as Error)?.message ?? ''))
  } finally {
    making.value = false
  }
}
const showExport = ref(false)
</script>

<template>
  <div class="screen">
    <AppBar title="统计分析" back @back="back()">
      <button class="btn text" :disabled="making" @click="makeImage"><Icon :path="ICON_IMAGE" :size="20" />发图片</button>
      <button class="icon-btn" aria-label="导出 Excel" @click="showExport = true"><Icon :path="ICON_SHARE" /></button>
    </AppBar>
    <div class="content stack">
      <div class="stack s6">
        <RangeChooser :range="range" :earliest="earliest" />
        <div class="hscroll">
          <button class="chip" :class="{ sel: cat === '' }" @click="cat = ''">全部本子</button>
          <button
            v-for="c in state.cats"
            :key="c.name"
            class="chip"
            :style="cat === c.name ? { background: catColor(c.name), color: '#fff', borderColor: 'transparent' } : {}"
            @click="cat = c.name"
          >
            {{ c.name }}
          </button>
        </div>
      </div>

      <div class="card primary stack s8">
        <div class="label" style="color: inherit">{{ rangeName }} · {{ dayCount }}</div>
        <div class="row">
          <div class="grow">
            <div class="big">{{ records.length }}</div>
            <div class="small">笔记录</div>
          </div>
          <div class="grow">
            <div class="big">{{ items.length }}</div>
            <div class="small">种东西</div>
          </div>
        </div>
        <div v-if="taken.length" class="small semi taken">其中减掉 {{ taken.length }} 笔，原因在下面</div>
      </div>

      <div class="seg">
        <button :class="{ on: tab === 0 }" @click="tab = 0">按品名</button>
        <button :class="{ on: tab === 1 }" @click="tab = 1">按日期</button>
      </div>

      <Empty v-if="!records.length" title="这段时间没有记录" sub="换个时间或本子看看" />
      <template v-else-if="tab === 0">
        <div v-for="[c, list] in groups" :key="c" class="stack s8">
          <div class="row" style="padding-top: 4px">
            <CatTag :cat="c" />
            <span class="muted">{{ list.length }} 种 · {{ records.filter((r) => r.category === c).length }} 笔</span>
          </div>
          <div class="table">
            <div class="tr th"><div class="td">品名</div><div class="td right">数量</div></div>
            <button v-for="s in list" :key="s.name" class="tr" @click="detail = s">
              <div class="td">{{ s.name }}</div>
              <div class="td r">
                <div :class="{ taken: s.total < 0 }">{{ s.twoLines()[0] }}</div>
                <div v-if="s.twoLines()[1]" class="small taken" style="font-weight: 500">{{ s.twoLines()[1] }}</div>
              </div>
            </button>
          </div>
        </div>
        <div v-if="taken.length" class="card taken-card stack s8">
          <div class="title-m taken">减掉的（{{ taken.length }} 笔）</div>
          <div v-for="r in taken" :key="r.id" class="row" style="align-items: flex-start">
            <span style="width: 92px; flex-shrink: 0" class="small">{{ shortDateWeek(r.date) }}</span>
            <div class="grow">
              <div class="row" style="gap: 6px">
                <CatTag v-if="!cat" :cat="r.category" />
                <span class="semi small">{{ r.name }}</span>
              </div>
              <div class="small taken">{{ takenText(r) }}</div>
            </div>
          </div>
        </div>
        <div class="small muted" style="padding: 0 4px">点一行可以看这个品名每天的明细</div>
      </template>
      <template v-else>
        <div v-for="d in days" :key="d.date" class="card stack s6">
          <div class="row">
            <span class="grow title-m">{{ shortDateWeek(d.date) }}{{ relativeDay(d.date) ? ` · ${relativeDay(d.date)}` : '' }}</span>
            <span class="title-s" style="color: var(--primary)">{{ d.items.length }} 种</span>
          </div>
          <template v-for="[c, list] in byCat(d.items)" :key="c">
            <hr class="divider" style="margin: 4px 0" />
            <div v-if="!cat" class="row" style="padding-top: 2px">
              <CatTag :cat="c" />
              <span class="small muted">{{ list.length }} 种</span>
            </div>
            <div v-for="s in list" :key="s.category + s.name" class="row">
              <span class="grow">{{ s.name }}</span>
              <span class="semi" :class="{ taken: s.total < 0 }">{{ s.unitsText() }}</span>
            </div>
          </template>
          <div v-for="r in d.records.filter((x) => x.taken)" :key="r.id" class="small taken">{{ r.name }}　{{ takenText(r) }}</div>
        </div>
      </template>
    </div>

    <Modal v-if="detail" :title="`${detail.category} · ${detail.name}`" @close="detail = null">
      <div class="semi">合计：{{ detail.fullText() }}</div>
      <hr class="divider" />
      <div v-for="r in detailRecs" :key="r.id" class="row">
        <div class="grow">
          <div>{{ shortDateWeek(r.date) }}</div>
          <div v-if="r.note && !r.taken" class="small muted">{{ r.note }}</div>
        </div>
        <span class="semi" :class="{ taken: r.taken }">{{ r.taken ? takenText(r) : amount(r) }}</span>
      </div>
      <template #actions><button class="btn text" @click="detail = null">关闭</button></template>
    </Modal>
    <Modal v-if="making" :dismissable="false" locked title="正在生成图片…"><div class="row"><div class="spinner" /><span>请稍等</span></div></Modal>
    <ImagePreview v-if="image" :blob="image.blob" :name="image.name" @close="image = null" />
    <ExportDialog v-if="showExport" :preset-category="cat || null" :preset="{ from: range.from, to: range.to }" @close="showExport = false" />
  </div>
</template>

<style scoped>
.big {
  font-size: 30px;
  font-weight: 700;
}
.seg {
  display: flex;
  border: 1px solid var(--outline);
  border-radius: 22px;
  overflow: hidden;
}
.seg button {
  flex: 1;
  height: 42px;
  font-weight: 600;
  font-size: 15px;
}
.seg button + button {
  border-left: 1px solid var(--outline);
}
.seg button.on {
  background: var(--secondary-container);
}
</style>
