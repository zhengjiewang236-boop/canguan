<script setup lang="ts">
// 加一个本子 / 改名字、颜色、图标
import { ref } from 'vue'
import type { Cat } from '../../data/model'
import { cssColor } from '../../data/model'
import { CAT_COLORS, CAT_ICONS } from '../../data/seeds'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import { catIcon, ICON_CHECK, ICON_DELETE, ICON_RIGHT } from '../icons'

const props = defineProps<{ initial: Cat; isNew: boolean; others: string[]; canDelete: boolean }>()
const emit = defineEmits<{ save: [Cat]; remove: []; openItems: []; close: [] }>()
const name = ref(props.initial.name)
const color = ref(props.initial.color)
const icon = ref(props.initial.icon)
const err = ref('')
function onName(e: Event) {
  name.value = (e.target as HTMLInputElement).value.replace(/[|\n]/g, '').slice(0, 8)
  ;(e.target as HTMLInputElement).value = name.value
  err.value = ''
}
function save() {
  const n = name.value.trim()
  if (!n) err.value = '请填写名字'
  else if (props.others.includes(n)) err.value = `已经有「${n}」了`
  else emit('save', { ...props.initial, name: n, color: color.value, icon: icon.value })
}
</script>
<template>
  <Modal :dismissable="false" :title="isNew ? '加一个本子' : `修改「${initial.name}」`" @close="emit('close')">
    <div class="pv" :style="{ background: cssColor(color) }">
      <Icon :path="catIcon(icon)" :size="28" />
      <span class="title-l">{{ name.trim() || '本子名字' }}</span>
    </div>
    <label class="field">
      <span>名字，比如 饮料、冻品</span>
      <input :value="name" class="input" @input="onName" />
    </label>
    <div v-if="!isNew && name.trim() !== initial.name && name.trim()" class="small" style="color: var(--secondary)">
      改名后，清单和以前记的「{{ initial.name }}」都会一起改过来。
    </div>
    <div class="label">颜色</div>
    <div class="row wrap" style="gap: 10px">
      <button v-for="c in CAT_COLORS" :key="c" class="sw" :class="{ on: c === color }" :style="{ background: cssColor(c) }" @click="color = c">
        <Icon v-if="c === color" :path="ICON_CHECK" :size="20" />
      </button>
    </div>
    <div class="label">图标</div>
    <div class="row wrap" style="gap: 8px">
      <button
        v-for="k in CAT_ICONS"
        :key="k"
        class="ic"
        :style="k === icon ? { background: cssColor(color), color: '#fff' } : {}"
        @click="icon = k"
      >
        <Icon :path="catIcon(k)" />
      </button>
    </div>
    <div v-if="err" class="err">{{ err }}</div>
    <template v-if="!isNew">
      <hr class="divider" />
      <div><button class="btn text" style="padding: 0 8px" @click="emit('openItems')">改这个本子里的东西<Icon :path="ICON_RIGHT" :size="18" /></button></div>
      <div v-if="canDelete"><button class="btn danger" @click="emit('remove')"><Icon :path="ICON_DELETE" :size="18" />删掉这个本子</button></div>
    </template>
    <template #actions>
      <button class="btn text" @click="emit('close')">取消</button>
      <button class="btn" @click="save">保存</button>
    </template>
  </Modal>
</template>
<style scoped>
.pv {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  color: #fff;
}
.sw {
  width: 38px;
  height: 38px;
  border-radius: 19px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.sw.on {
  outline: 3px solid var(--on-bg);
  outline-offset: 1px;
}
.ic {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--s-highest);
  color: var(--on-surface-variant);
}
</style>
