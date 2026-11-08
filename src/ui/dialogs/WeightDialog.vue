<script setup lang="ts">
// 改某一箱的重量，或者删掉这一箱
import { ref } from 'vue'
import { fmtQty, parseQty } from '../../data/model'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import { ICON_DELETE } from '../icons'
const props = defineProps<{ title: string; value: number; unit: string }>()
const emit = defineEmits<{ save: [number]; remove: []; close: [] }>()
const text = ref(fmtQty(props.value))
const err = ref(false)
function save() {
  const w = parseQty(text.value)
  if (w == null || w <= 0) err.value = true
  else emit('save', w)
}
</script>
<template>
  <Modal :title="title" @close="emit('close')">
    <label class="field">
      <span>重量（{{ unit }}）</span>
      <input v-model="text" class="input big-num" :class="{ bad: err }" inputmode="decimal" @input="err = false" @keydown.enter.prevent="save" />
    </label>
    <div><button class="btn danger" @click="emit('remove')"><Icon :path="ICON_DELETE" :size="18" />删掉这一箱</button></div>
    <template #actions>
      <button class="btn text" @click="emit('close')">取消</button>
      <button class="btn" @click="save">保存</button>
    </template>
  </Modal>
</template>
