<script setup lang="ts">
import { computed } from 'vue'
import { nav } from './ui/nav'
import { runToastAction, toastState } from './ui/toast'
import Home from './ui/screens/Home.vue'
import Book from './ui/screens/Book.vue'
import Stats from './ui/screens/Stats.vue'
import Settings from './ui/screens/Settings.vue'
import Categories from './ui/screens/Categories.vue'
import AiSettings from './ui/screens/AiSettings.vue'
import RestoreFlow from './ui/dialogs/RestoreFlow.vue'
import DownloadHelp from './ui/dialogs/DownloadHelp.vue'

const top = computed(() => nav.stack[nav.stack.length - 1])
// 下面一层的页面留着（不重新加载），只显示最上面的
const lift = computed(() => top.value.name === 'settings' || top.value.name === 'cats')
</script>

<template>
  <template v-for="s in nav.stack" :key="s.uid">
    <div v-show="s === top" class="layer">
      <Home v-if="s.name === 'home'" />
      <Book v-else-if="s.name === 'book'" :cat="s.cat" />
      <Stats v-else-if="s.name === 'stats'" />
      <Settings v-else-if="s.name === 'settings'" :initial="s.cat" />
      <Categories v-else-if="s.name === 'cats'" />
      <AiSettings v-else-if="s.name === 'ai'" />
    </div>
  </template>
  <RestoreFlow />
  <DownloadHelp />
  <Transition name="toast">
    <div v-if="toastState.msg" :key="toastState.id" class="toast" :class="{ lift }">
      <span class="grow">{{ toastState.msg }}</span>
      <button v-if="toastState.action" class="ta" @click="runToastAction">{{ toastState.action }}</button>
    </div>
  </Transition>
</template>

<style>
.toast {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(20px + env(safe-area-inset-bottom));
  z-index: 100;
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  background: #33312c;
  color: #f4f0e8;
  font-size: 15px;
  box-shadow: var(--shadow);
}
.toast.lift {
  bottom: calc(88px + env(safe-area-inset-bottom));
}
.toast .ta {
  color: #9cd3bc;
  font-weight: 700;
  padding: 4px 8px;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
