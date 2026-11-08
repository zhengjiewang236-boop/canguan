<script setup lang="ts">
// 点一下选日期：在里面的内容上盖一个透明的日期输入框，iPhone / 安卓都会弹出系统的日期选择
const props = defineProps<{ value: string | null; fallback?: string }>()
const emit = defineEmits<{ pick: [string] }>()
function onChange(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (v) emit('pick', v)
}
</script>
<template>
  <label class="dp">
    <slot />
    <input type="date" :value="props.value ?? props.fallback ?? ''" @change="onChange" />
  </label>
</template>
<style scoped>
.dp {
  position: relative;
  display: block;
  cursor: pointer;
  border-radius: 12px;
}
.dp input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  border: none;
  padding: 0;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
  font-size: 16px;
}
.dp input::-webkit-calendar-picker-indicator {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
</style>
