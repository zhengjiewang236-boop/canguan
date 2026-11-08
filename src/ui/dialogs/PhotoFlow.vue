<script setup lang="ts">
// 拍照识别：选照片 → 发给 DeepSeek → 核对页 → 填进去
import { ref, onBeforeUnmount } from 'vue'
import type { Item } from '../../data/model'
import { today } from '../../data/model'
import { state } from '../../data/db'
import { ask } from '../../io/deepseek'
import { shrink } from '../../io/photo'
import type { Result } from '../../io/recognize'
import { match, parse, systemPrompt, USER_TEXT } from '../../io/recognize'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import Review from './Review.vue'
import { ICON_CAMERA, ICON_GALLERY } from '../icons'

const props = defineProps<{ cat: string; items: Item[]; date: string }>()
const emit = defineEmits<{ applied: [string]; openAi: [] }>()

const choosing = ref(false)
const needKey = ref(false)
const working = ref(false)
const seconds = ref(0)
const error = ref('')
const review = ref<{ photo: string; result: Result } | null>(null)
const camera = ref<HTMLInputElement>()
const gallery = ref<HTMLInputElement>()
let lastFile: File | null = null
let ctl: AbortController | null = null
let tick: ReturnType<typeof setInterval> | undefined

function start() {
  if (!state.prefs.aiKey.trim()) needKey.value = true
  else choosing.value = true
}
defineExpose({ start })

function pick(which: 'camera' | 'gallery') {
  choosing.value = false
  const el = which === 'camera' ? camera.value : gallery.value
  if (el) {
    el.value = ''
    el.click()
  }
}
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) recognize(f)
}

async function recognize(f: File) {
  lastFile = f
  error.value = ''
  working.value = true
  seconds.value = 0
  clearInterval(tick)
  tick = setInterval(() => seconds.value++, 1000)
  ctl?.abort()
  const my = (ctl = new AbortController())
  const p = state.prefs
  const cfg = { key: p.aiKey, baseUrl: p.aiBaseUrl, model: p.aiModel, careful: p.aiCareful }
  const list = props.items
  try {
    const img = await shrink(f)
    const answer = await ask(cfg, systemPrompt(props.cat, list, today()), USER_TEXT, img.base64, 120_000, cfg.careful, my.signal)
    if (my.signal.aborted) return
    review.value = { photo: img.dataUrl, result: match(list, parse(answer)) }
  } catch (e) {
    if (my.signal.aborted) return
    error.value = (e as Error)?.message || '识别失败'
  } finally {
    if (ctl === my) {
      working.value = false
      clearInterval(tick)
    }
  }
}
function cancel() {
  ctl?.abort()
  ctl = null
  working.value = false
  clearInterval(tick)
}
onBeforeUnmount(cancel)
const keyProblem = () => /Key|模型|接口地址/.test(error.value)
function retry() {
  if (lastFile) recognize(lastFile)
  else error.value = ''
}
</script>
<template>
  <input ref="camera" type="file" accept="image/*" capture="environment" hidden @change="onFile" />
  <input ref="gallery" type="file" accept="image/*" hidden @change="onFile" />

  <Modal v-if="choosing" :title="`拍照识别 · ${cat}`" @close="choosing = false">
    <div>拍「{{ cat }}」这张单子，尽量拍正、拍全、光线亮一点。认出来的数字会先给你核对。</div>
    <button class="btn outline big block" @click="pick('camera')"><Icon :path="ICON_CAMERA" />拍照</button>
    <button class="btn outline big block" @click="pick('gallery')"><Icon :path="ICON_GALLERY" />从相册选</button>
    <template #actions><button class="btn text" @click="choosing = false">取消</button></template>
  </Modal>

  <Modal v-if="needKey" title="还没设置 DeepSeek Key" @close="needKey = false">
    <div>拍照识别要用 DeepSeek。先到「拍照识别设置」里填好 API Key，只要填一次。</div>
    <template #actions>
      <button class="btn text" @click="needKey = false">取消</button>
      <button class="btn" @click="((needKey = false), emit('openAi'))">去设置</button>
    </template>
  </Modal>

  <Modal v-if="working" :dismissable="false" title="正在识别…">
    <div class="row" style="gap: 16px">
      <div class="spinner" />
      <div>
        <div>{{ state.prefs.aiCareful ? 'DeepSeek 正在仔细看照片（“仔细识别”开着，会慢一些）' : 'DeepSeek 正在看照片…' }}</div>
        <div class="small muted">已等 {{ seconds }} 秒</div>
      </div>
    </div>
    <template #actions><button class="btn text" @click="cancel">取消</button></template>
  </Modal>

  <Modal v-if="error" title="识别没成功" @close="error = ''">
    <div>{{ error }}</div>
    <template #actions>
      <button class="btn text" @click="error = ''">关闭</button>
      <button v-if="keyProblem()" class="btn" @click="((error = ''), emit('openAi'))">去设置</button>
      <button v-else class="btn" @click="retry">再试一次</button>
    </template>
  </Modal>

  <Review
    v-if="review"
    :cat="cat"
    :photo="review.photo"
    :result="review.result"
    :initial-date="date"
    @close="review = null"
    @applied="(d) => ((review = null), emit('applied', d))"
  />
</template>
