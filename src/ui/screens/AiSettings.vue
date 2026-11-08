<script setup lang="ts">
// 拍照识别设置：DeepSeek 的 Key（只存在这台手机里，会写进备份文件）
import { ref } from 'vue'
import { DEFAULT_BASE_URL, DEFAULT_MODEL, savePrefs, state } from '../../data/db'
import { test } from '../../io/deepseek'
import AppBar from '../components/AppBar.vue'
import Icon from '../components/Icon.vue'
import { back } from '../nav'
import { toast } from '../toast'
import { ICON_EYE, ICON_EYE_OFF } from '../icons'

const key = ref(state.prefs.aiKey)
const url = ref(state.prefs.aiBaseUrl)
const model = ref(state.prefs.aiModel)
const careful = ref(state.prefs.aiCareful)
const showKey = ref(false)
const advanced = ref(url.value !== DEFAULT_BASE_URL || model.value !== DEFAULT_MODEL)
const testing = ref(false)
const result = ref<{ ok: boolean; msg: string } | null>(null)

const cfg = () => ({
  key: key.value.trim(),
  baseUrl: url.value.trim().replace(/\/+$/, '') || DEFAULT_BASE_URL,
  model: model.value.trim() || DEFAULT_MODEL,
  careful: careful.value,
})
async function save() {
  const c = cfg()
  await savePrefs({ aiKey: c.key, aiBaseUrl: c.baseUrl, aiModel: c.model, aiCareful: c.careful })
  toast('已保存')
}
async function saveAndBack() {
  await save()
  back()
}
async function runTest() {
  testing.value = true
  result.value = null
  try {
    await test(cfg())
    result.value = { ok: true, msg: '连接成功，可以用了' }
  } catch (e) {
    result.value = { ok: false, msg: (e as Error)?.message || '出错了' }
  } finally {
    testing.value = false
  }
}
function resetDefaults() {
  url.value = DEFAULT_BASE_URL
  model.value = DEFAULT_MODEL
  result.value = null
}
</script>

<template>
  <div class="screen">
    <AppBar title="拍照识别设置" back @back="back()">
      <button class="btn text" @click="saveAndBack">保存</button>
    </AppBar>
    <div class="content stack">
      <div class="small muted">
        拍照识别用 DeepSeek 读照片上的数字。在 DeepSeek 开放平台（platform.deepseek.com）注册、充值后，在「API keys」里创建一个 Key，粘贴到下面。
      </div>
      <label class="field">
        <span>API Key（sk- 开头）</span>
        <div class="row" style="gap: 4px">
          <input
            v-model="key"
            class="input grow"
            :type="showKey ? 'text' : 'password'"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="sk-..."
            @input="result = null"
          />
          <button class="icon-btn" :aria-label="showKey ? '隐藏' : '显示'" @click.prevent="showKey = !showKey">
            <Icon :path="showKey ? ICON_EYE_OFF : ICON_EYE" />
          </button>
        </div>
      </label>

      <template v-if="advanced">
        <label class="field">
          <span>接口地址</span>
          <input v-model="url" class="input" autocapitalize="off" spellcheck="false" @input="result = null" />
        </label>
        <label class="field">
          <span>模型名（要能看图片的）</span>
          <input v-model="model" class="input" autocapitalize="off" spellcheck="false" @input="result = null" />
        </label>
        <div><button class="btn text" style="padding: 0; white-space: normal; text-align: left" @click="resetDefaults">恢复默认（{{ DEFAULT_BASE_URL }} · {{ DEFAULT_MODEL }}）</button></div>
      </template>
      <div v-else>
        <button class="btn text" style="padding: 0; white-space: normal; text-align: left" @click="advanced = true">
          接口地址 / 模型名：{{ DEFAULT_MODEL }}（一般不用改，点这里修改）
        </button>
      </div>

      <button class="card row" style="text-align: left; width: 100%" @click="careful = !careful">
        <div class="grow">
          <div class="bold">仔细识别</div>
          <div class="small muted">
            {{ careful ? '开着：DeepSeek 先想一想再回答，字很乱时可能更准，但要多等很久，也更费钱。' : '关着（推荐）：直接读数字，快很多。认得不准时再打开试试。' }}
          </div>
        </div>
        <span class="switch" :class="{ on: careful }"><span /></span>
      </button>

      <div class="row">
        <button class="btn outline grow" :disabled="testing || !key.trim()" @click="runTest">{{ testing ? '测试中…' : '测试一下' }}</button>
        <button class="btn grow" @click="saveAndBack">保存</button>
      </div>
      <div v-if="result" class="card" :style="{ background: result.ok ? 'var(--primary-container)' : 'var(--error-container)', color: result.ok ? 'var(--on-primary-container)' : 'var(--on-error-container)' }">
        {{ result.msg }}
      </div>

      <div class="card stack s6">
        <div class="bold">换手机不用重填</div>
        <div class="small">
          这里的设置（包括 Key）会写进首页「备份数据」的备份文件，换手机「恢复数据」时一起恢复。所以备份文件只发给自己，不要发给别人。发给老板的表格和图片里没有 Key。
        </div>
      </div>
      <div class="card stack s6">
        <div class="bold">怎么用</div>
        <div class="small">
          进到某个本子，点上面的「拍照识别」，拍下这个本子的单子（或从相册选）。认出来的数字会先给你核对，改好了再填进当天。每次识别会用掉一点 DeepSeek 余额。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.switch {
  width: 52px;
  height: 32px;
  border-radius: 16px;
  background: var(--s-highest);
  border: 2px solid var(--outline);
  position: relative;
  flex-shrink: 0;
  transition: background 0.15s;
}
.switch span {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--outline);
  transition: all 0.15s;
}
.switch.on {
  background: var(--primary);
  border-color: var(--primary);
}
.switch.on span {
  left: 24px;
  top: 2px;
  width: 24px;
  height: 24px;
  border-radius: 12px;
  background: var(--on-primary);
}
</style>
