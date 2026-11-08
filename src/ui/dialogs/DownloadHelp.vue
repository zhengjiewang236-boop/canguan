<script setup lang="ts">
// 安卓上 Excel 不能直接分享，已经存到手机的「下载」里了：告诉人怎么用微信发出去
import Modal from '../components/Modal.vue'
import { downloadHelp } from '../flows'
import { isIOS } from '../common'
const ios = isIOS()
const close = () => (downloadHelp.name = '')
</script>
<template>
  <Modal v-if="downloadHelp.name" title="已存到手机" @close="close">
    <div>
      文件在手机的{{ ios ? '「文件」App →「下载」' : '「下载」文件夹' }}里：
      <div class="fname">{{ downloadHelp.name }}</div>
    </div>
    <div v-if="downloadHelp.kind === 'boss'" class="stack s6">
      <div class="semi">发给老板（微信）</div>
      <div class="small">打开微信 → 跟老板的聊天 → 右下角 <b>＋</b> →「文件」→ 在「手机存储」或「下载」里找到这个文件 → 发送。</div>
      <div class="small muted">统计图片可以直接分享：统计分析 → 发图片 → 发给老板。</div>
    </div>
    <div v-else-if="downloadHelp.kind === 'backup'" class="stack s6">
      <div class="semi">存到微信</div>
      <div class="small">打开微信 →「文件传输助手」→ 右下角 <b>＋</b> →「文件」→ 在「手机存储」或「下载」里找到这个文件 → 发送。</div>
      <div class="small muted">备份里有 DeepSeek Key，只发给自己。</div>
    </div>
    <div v-else class="stack s6">
      <div class="semi">发到别的手机</div>
      <div class="small">在微信里把这个文件发过去；那台手机打开网页版 → 设置 → 右上角 ⋮ →「从文件导入清单」。</div>
    </div>
    <template #actions>
      <a class="btn text" href="weixin://" style="text-decoration: none">打开微信</a>
      <button class="btn" @click="close">知道了</button>
    </template>
  </Modal>
</template>
<style scoped>
.fname {
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--s-lowest);
  font-weight: 600;
  word-break: break-all;
}
</style>
