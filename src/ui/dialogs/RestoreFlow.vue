<script setup lang="ts">
// 从备份恢复：勾选要恢复的记录 / 本子和清单 / 设置
import { computed, ref, watch } from 'vue'
import Modal from '../components/Modal.vue'
import Check from '../components/Check.vue'
import { restoreState } from '../flows'
import { applyRestore } from '../../data/backup'
import { toast } from '../toast'

const withRecords = ref(true)
const withLists = ref(true)
const withSettings = ref(true)
watch(
  () => restoreState.preview,
  (p) => {
    if (p) {
      withRecords.value = true
      withLists.value = p.items.length > 0 || p.cats.length > 0
      withSettings.value = true
    }
  },
)
const p = computed(() => restoreState.preview)
const hasLists = computed(() => !!p.value && (p.value.items.length > 0 || p.value.cats.length > 0))
const hasRecords = computed(() => !!p.value && p.value.total > 0)
const hasSettings = computed(() => !!p.value && p.value.settings.size > 0)
const canDo = computed(
  () => !!p.value && ((hasRecords.value && withRecords.value && p.value.fresh.length > 0) || (hasLists.value && withLists.value) || (hasSettings.value && withSettings.value)),
)
const recSub = computed(() => {
  const x = p.value!
  let s = `文件里共 ${x.total} 条`
  if (x.dup > 0) s += `，手机里已有 ${x.dup} 条会跳过`
  if (x.bad > 0) s += `，${x.bad} 行看不懂会跳过`
  return s
})
const listSub = computed(() => {
  const x = p.value!
  const names = [...new Set([...x.cats.map((c) => c.name), ...x.items.map((i) => i.category)])]
  return names.map((c) => `${c} ${x.items.filter((i) => i.category === c).length} 样`).join('、') + '。会换掉这台手机现在的清单。'
})
const saving = ref(false)
async function run() {
  const x = p.value!
  saving.value = true
  try {
    const msg = await applyRestore(x, {
      records: hasRecords.value && withRecords.value,
      lists: hasLists.value && withLists.value,
      settings: hasSettings.value && withSettings.value,
    })
    restoreState.preview = null
    toast(msg)
  } catch (e) {
    restoreState.preview = null
    restoreState.error = '恢复失败：' + ((e as Error)?.message ?? '')
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <Modal v-if="restoreState.busy" :dismissable="false" locked title="正在读文件…">
    <div class="row"><div class="spinner" /><span>请稍等</span></div>
  </Modal>
  <Modal v-if="p" :title="hasRecords || hasSettings ? '从备份恢复' : '导入清单'" @close="restoreState.preview = null">
    <Check v-if="hasRecords" :checked="withRecords" :title="`恢复记录：新的 ${p.fresh.length} 条`" :sub="recSub" @toggle="withRecords = !withRecords" />
    <Check v-if="hasLists" :checked="withLists" title="恢复本子和清单（顺序、单位、分区、称重都一样）" :sub="listSub" @toggle="withLists = !withLists" />
    <Check v-if="hasSettings" :checked="withSettings" title="恢复设置（拍照识别的 DeepSeek Key）" sub="恢复后不用再填 Key。" @toggle="withSettings = !withSettings" />
    <div v-if="!hasRecords && !hasLists && !hasSettings" class="muted">文件里没有可以恢复的内容。</div>
    <template #actions>
      <template v-if="canDo">
        <button class="btn text" @click="restoreState.preview = null">取消</button>
        <button class="btn" :disabled="saving" @click="run">恢复</button>
      </template>
      <button v-else class="btn text" @click="restoreState.preview = null">知道了</button>
    </template>
  </Modal>
  <Modal v-if="restoreState.error" title="恢复失败" @close="restoreState.error = ''">
    <div>{{ restoreState.error }}</div>
    <template #actions><button class="btn text" @click="restoreState.error = ''">知道了</button></template>
  </Modal>
</template>
