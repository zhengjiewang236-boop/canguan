<script setup lang="ts">
// 管理本子：加、改名、换颜色和图标、删除；按住 ≡ 上下拖，首页的按钮就按这个顺序排
import { computed, ref } from 'vue'
import type { Cat } from '../../data/model'
import * as db from '../../data/db'
import { state } from '../../data/db'
import AppBar from '../components/AppBar.vue'
import Icon from '../components/Icon.vue'
import SortList from '../components/SortList.vue'
import CatDialog from '../dialogs/CatDialog.vue'
import Confirm from '../dialogs/Confirm.vue'
import { back, push } from '../nav'
import { catColor, queue } from '../common'
import { catIcon, ICON_ADD, ICON_DRAG } from '../icons'

const cats = computed(() => state.cats)
const counts = computed(() => db.categoryCounts())
const editing = ref<Cat | null>(null)
const adding = ref(false)
const dlgKey = ref(0)
const confirmDelete = ref<Cat | null>(null)

function openAdd() {
  editing.value = null
  adding.value = true
  dlgKey.value++
}
function openEdit(c: Cat) {
  editing.value = { ...c }
  adding.value = false
  dlgKey.value++
}
function save(c: Cat) {
  const old = editing.value
  adding.value = false
  editing.value = null
  queue(() => db.saveCategory(c, old))
}
function askDelete() {
  confirmDelete.value = editing.value
  editing.value = null
}
function doDelete() {
  const n = confirmDelete.value!.name
  confirmDelete.value = null
  queue(() => db.deleteCategory(n))
}
function openItems() {
  const n = editing.value!.name
  editing.value = null
  push({ name: 'settings', cat: n })
}
const cnt = (n: string) => counts.value.get(n) ?? [0, 0]
</script>

<template>
  <div class="screen">
    <AppBar title="管理本子" back @back="back()" />
    <div class="content stack s8" style="padding-bottom: 112px">
      <div class="small muted">按住右边的 ≡ 上下拖，首页的按钮就按这个顺序排。点一个本子可以改名字、颜色、图标。</div>
      <SortList :key="cats.map((c) => c.id).join(',')" :ids="cats.map((c) => c.id!)" @move="(ids) => queue(() => db.reorderCategories(ids))">
        <div v-for="c in cats" :key="c.id" class="crow" @click="openEdit(c)">
          <div class="ico" :style="{ background: catColor(c.name) }"><Icon :path="catIcon(c.icon)" /></div>
          <div class="grow">
            <div class="title-m">{{ c.name }}</div>
            <div class="small muted">清单 {{ cnt(c.name)[0] }} 样 · 记录 {{ cnt(c.name)[1] }} 条</div>
          </div>
          <span class="icon-btn handle" aria-label="按住拖动" @click.stop><Icon :path="ICON_DRAG" /></span>
        </div>
      </SortList>
    </div>
    <button class="fab" @click="openAdd"><Icon :path="ICON_ADD" />加一个本子</button>
    <CatDialog
      v-if="adding || editing"
      :key="dlgKey"
      :initial="editing ?? { name: '', color: db.nextColor(), icon: 'box', sort: 0 }"
      :is-new="!editing"
      :others="cats.filter((c) => c.name !== editing?.name).map((c) => c.name)"
      :can-delete="!!editing && cats.length > 1"
      @close="((adding = false), (editing = null))"
      @save="save"
      @remove="askDelete"
      @open-items="openItems"
    />
    <Confirm
      v-if="confirmDelete"
      :title="`删掉「${confirmDelete.name}」？`"
      :text="`首页就没有这个本子了，它清单里的 ${cnt(confirmDelete.name)[0]} 样东西也会删掉。` + (cnt(confirmDelete.name)[1] > 0 ? `以前记的 ${cnt(confirmDelete.name)[1]} 条数字不会删，统计和表格里还能看到。` : '')"
      confirm="删掉"
      @close="confirmDelete = null"
      @ok="doDelete"
    />
  </div>
</template>

<style scoped>
.crow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px 10px 12px;
  border-radius: 16px;
  background: var(--s-low);
  cursor: pointer;
}
.ico {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.handle {
  touch-action: none;
  cursor: grab;
  color: var(--on-surface-variant);
}
</style>
