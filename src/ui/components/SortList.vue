<script setup lang="ts" generic="K extends string | number">
// 按住 ≡ 上下拖动排序（SortableJS）。拖完把 DOM 放回原样，交给数据去重新排，免得跟 Vue 打架。
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Sortable from 'sortablejs'
const props = defineProps<{ ids: K[] }>()
const emit = defineEmits<{ move: [K[]] }>()
const el = ref<HTMLElement>()
let s: Sortable | undefined
onMounted(() => {
  s = Sortable.create(el.value!, {
    handle: '.handle',
    animation: 150,
    delay: 0,
    forceFallback: true, // iPhone 上用 HTML5 拖动不顺，用模拟的
    fallbackTolerance: 3,
    onEnd(e) {
      const { item, from, oldIndex, newIndex } = e
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
      item.remove()
      const ref = oldIndex === 0 ? from.children[0] : from.children[oldIndex - 1]?.nextSibling
      from.insertBefore(item, ref ?? null)
      const ids = [...props.ids]
      const [m] = ids.splice(oldIndex, 1)
      ids.splice(newIndex, 0, m)
      emit('move', ids)
    },
  })
})
onBeforeUnmount(() => s?.destroy())
</script>
<template>
  <div ref="el" class="sort-list"><slot /></div>
</template>
<style scoped>
.sort-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
