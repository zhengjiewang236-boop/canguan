<script setup lang="ts">
// 设置（控制台）：选本子 → 加东西、改名、改单位、换到别的本子、删除；按住 ≡ 拖动调顺序（同一个分区里）
import { computed, ref, watch } from 'vue'
import type { Item } from '../../data/model'
import * as db from '../../data/db'
import { state } from '../../data/db'
import { seedsOf } from '../../data/seeds'
import { makeLists } from '../../data/backup'
import { MIME } from '../../io/report'
import { shareFile } from '../../io/share'
import AppBar from '../components/AppBar.vue'
import Icon from '../components/Icon.vue'
import Empty from '../components/Empty.vue'
import SortList from '../components/SortList.vue'
import ItemDialog from '../dialogs/ItemDialog.vue'
import Confirm from '../dialogs/Confirm.vue'
import { back, catRename, push } from '../nav'
import { catColor, queue } from '../common'
import { showDownloadHelp, startRestore } from '../flows'
import { toast } from '../toast'
import { ICON_ADD, ICON_BOOKS, ICON_CAMERA, ICON_DRAG, ICON_FOLDER, ICON_MORE, ICON_RESTORE, ICON_SHARE } from '../icons'

const props = defineProps<{ initial?: string }>()
const catState = ref(props.initial ?? state.cats[0]?.name ?? '')
// 本子被删 / 改名后，选中的本子不在了就回到第一个
const cat = computed(() => (state.cats.some((c) => c.name === catState.value) ? catState.value : (state.cats[0]?.name ?? '')))
watch(
  () => catRename.n,
  () => {
    if (catState.value === catRename.from) catState.value = catRename.to
  },
)
const all = computed(() => db.allItems())
const items = computed(() => all.value.filter((i) => i.category === cat.value))
const sections = computed(() => {
  const m = new Map<string, Item[]>()
  for (const it of items.value) m.set(it.section, [...(m.get(it.section) ?? []), it])
  return [...m.entries()]
})

function move(section: string, ids: number[]) {
  // 只在同一个分区里拖：拼回整个本子的顺序
  const order = sections.value.flatMap(([s, l]) => (s === section ? ids : l.map((i) => i.id!)))
  const c = cat.value
  queue(() => db.reorderItems(c, order))
}

const editing = ref<Item | null>(null)
const adding = ref(false)
const dlgKey = ref(0)
const confirmDelete = ref<Item | null>(null)
const confirmReset = ref(false)
const menu = ref(false)

function openAdd() {
  adding.value = true
  editing.value = null
  dlgKey.value++
}
function openEdit(it: Item) {
  editing.value = { ...it }
  adding.value = false
  dlgKey.value++
}
const newItem = (): Item => {
  const last = items.value[items.value.length - 1]
  return { category: cat.value, section: last?.section ?? '', name: '', unit: last?.unit ?? '箱', hint: '', weigh: false, sort: 0 }
}
function save(item: Item) {
  const old = editing.value
  adding.value = false
  editing.value = null
  queue(() => db.saveItem(item, old))
  if (old && item.category !== cat.value) toast(`已移到「${item.category}」`)
}
function askDelete() {
  confirmDelete.value = editing.value
  editing.value = null
  adding.value = false
}
async function sendLists() {
  menu.value = false
  const { name, bytes } = makeLists()
  const r = await shareFile(bytes, name, MIME, '餐馆记账清单')
  if (r === 'downloaded') showDownloadHelp(name, 'lists')
}
function doDelete() {
  const id = confirmDelete.value!.id!
  confirmDelete.value = null
  queue(() => db.deleteItem(id))
}
function doReset() {
  const c = cat.value
  confirmReset.value = false
  queue(() => db.resetItems(c))
}
function importLists() {
  menu.value = false
  startRestore()
}
</script>

<template>
  <div class="screen">
    <AppBar title="设置" back @back="back()">
      <button class="btn text" @click="push({ name: 'cats' })"><Icon :path="ICON_BOOKS" :size="18" />管理本子</button>
      <button class="icon-btn" aria-label="更多" @click="menu = !menu"><Icon :path="ICON_MORE" /></button>
    </AppBar>
    <Teleport to="body">
      <div v-if="menu" class="menu-scrim" @click="menu = false">
        <div class="menu" @click.stop>
          <button @click="((menu = false), push({ name: 'ai' }))"><Icon :path="ICON_CAMERA" />拍照识别设置（DeepSeek Key）</button>
          <hr class="divider" />
          <button @click="sendLists"><Icon :path="ICON_SHARE" />把清单发到别的手机</button>
          <button @click="importLists"><Icon :path="ICON_FOLDER" />从文件导入清单</button>
          <template v-if="seedsOf(cat).length">
            <hr class="divider" />
            <button @click="((menu = false), (confirmReset = true))"><Icon :path="ICON_RESTORE" />把「{{ cat }}」恢复成照片上的清单</button>
          </template>
        </div>
      </div>
    </Teleport>

    <div class="content stack s8" style="padding-bottom: 112px">
      <div class="hscroll">
        <button
          v-for="c in state.cats"
          :key="c.name"
          class="chip"
          :style="cat === c.name ? { background: catColor(c.name), color: '#fff', borderColor: 'transparent' } : {}"
          @click="catState = c.name"
        >
          {{ c.name }}（{{ all.filter((i) => i.category === c.name).length }}）
        </button>
        <button class="chip assist" @click="push({ name: 'cats' })">+ 加本子 / 排序</button>
      </div>
      <div class="small muted">
        这里的东西每天都会出现在「{{ cat }}」里，只要填数字。点一样可以改名、改单位、换到别的本子；按住右边的 ≡ 上下拖可以调顺序。
        别的手机也要用一样的清单：右上角 ⋮ →「把清单发到别的手机」。
      </div>
      <Empty v-if="!items.length" :title="`「${cat}」还没有东西`" sub="点右下角「加一样东西」" />
      <template v-for="[section, list] in sections" :key="cat + '|' + section + '|' + list.map((i) => i.id).join(',')">
        <div v-if="section" class="title-s" :style="{ color: catColor(cat), padding: '8px 0 0 4px' }">{{ section }}</div>
        <SortList :ids="list.map((i) => i.id!)" @move="(ids) => move(section, ids)">
          <div v-for="it in list" :key="it.id" class="srow" @click="openEdit(it)">
            <div class="grow">
              <div class="semi">{{ it.name }}</div>
              <div class="small muted">{{ (it.weigh ? `每箱称重 · 单位 ${it.unit}` : `填数量 · 单位 ${it.unit}`) + (it.hint ? ` · ${it.hint}` : '') }}</div>
            </div>
            <span class="icon-btn handle" aria-label="按住拖动" @click.stop><Icon :path="ICON_DRAG" /></span>
          </div>
        </SortList>
      </template>
    </div>
    <button class="fab" :style="{ background: catColor(cat) }" @click="openAdd"><Icon :path="ICON_ADD" />加一样东西</button>

    <ItemDialog v-if="adding || editing" :key="dlgKey" :initial="editing ?? newItem()" :is-new="!editing" :all="all" @close="((adding = false), (editing = null))" @save="save" @remove="askDelete" />
    <Confirm
      v-if="confirmDelete"
      :title="`从清单里删掉「${confirmDelete.name}」？`"
      text="以后每天就不再显示这一样。以前记过的数字不会删，统计里还在。"
      confirm="删掉"
      @close="confirmDelete = null"
      @ok="doDelete"
    />
    <Confirm
      v-if="confirmReset"
      :title="`恢复「${cat}」的清单？`"
      :text="`会把「${cat}」的清单换回照片上的样子，你自己加的、改的都会没了。以前记过的数字不受影响。`"
      confirm="恢复"
      @close="confirmReset = false"
      @ok="doReset"
    />
  </div>
</template>

<style scoped>
.srow {
  display: flex;
  align-items: center;
  padding: 8px 4px 8px 16px;
  border-radius: 12px;
  background: var(--s-low);
  cursor: pointer;
}
.handle {
  touch-action: none;
  cursor: grab;
  color: var(--on-surface-variant);
}
</style>
<style>
.menu-scrim {
  position: fixed;
  inset: 0;
  z-index: 45;
}
.menu {
  position: absolute;
  right: 8px;
  top: calc(52px + env(safe-area-inset-top));
  min-width: 260px;
  max-width: calc(100vw - 16px);
  padding: 8px 0;
  border-radius: 12px;
  background: var(--s-high);
  box-shadow: var(--shadow);
}
.menu button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  font-size: 15px;
}
.menu .divider {
  margin: 6px 0;
}
</style>
