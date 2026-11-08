<script setup lang="ts">
import { computed } from 'vue'
import { catColor, tint } from '../common'
const props = defineProps<{ cat: string }>()
const c = computed(() => catColor(props.cat))
</script>
<template>
  <span class="cat-tag" :style="{ background: tint(c, 0.16), color: c }">{{ cat }}</span>
</template>
