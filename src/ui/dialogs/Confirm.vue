<script setup lang="ts">
import Modal from '../components/Modal.vue'
defineProps<{ title: string; text: string; confirm: string }>()
const emit = defineEmits<{ ok: []; close: [] }>()
</script>
<template>
  <Modal :title="title" @close="emit('close')">
    <div>{{ text }}</div>
    <template #actions>
      <button class="btn text" @click="emit('close')">取消</button>
      <button class="btn text" style="color: var(--error)" @click="emit('ok')">{{ confirm }}</button>
    </template>
  </Modal>
</template>
