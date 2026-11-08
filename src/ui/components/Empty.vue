<script setup lang="ts">
defineProps<{ title: string; sub?: string }>()
</script>
<template>
  <div class="empty">
    <div class="t">{{ title }}</div>
    <div v-if="sub" class="s">{{ sub }}</div>
  </div>
</template>
