<template>
  <div class="window-controls">
    <button class="win-btn close" @click="close" title="关闭">
      <svg viewBox="0 0 12 12" width="12" height="12">
        <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="win-btn minimize" @click="minimize" title="最小化">
      <svg viewBox="0 0 12 12" width="12" height="12">
        <path d="M2 6 L10 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="win-btn maximize" @click="maximize" :title="isMax ? '还原' : '最大化'">
      <svg v-if="!isMax" viewBox="0 0 12 12" width="12" height="12">
        <rect x="2.5" y="2.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <svg v-else viewBox="0 0 12 12" width="12" height="12">
        <path d="M4 2.5 L9.5 2.5 L9.5 8 M8 9.5 L2.5 9.5 L2.5 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const isMax = ref(false);

async function minimize() {
  try { await window.api.window.minimize(); } catch (e) {}
}
async function maximize() {
  try {
    await window.api.window.maximize();
    isMax.value = await window.api.window.isMaximized();
  } catch (e) {}
}
async function close() {
  try { await window.api.window.close(); } catch (e) {}
}

onMounted(async () => {
  try {
    isMax.value = await window.api.window.isMaximized();
  } catch (e) {}
});
</script>

<style scoped>
.window-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}
.win-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: filter 0.15s;
  color: rgba(0, 0, 0, 0.5);
}
.win-btn:hover {
  filter: brightness(0.9);
}
.win-btn.close {
  background: #ff5f57;
  color: rgba(0, 0, 0, 0.4);
}
.win-btn.close:hover {
  color: rgba(0, 0, 0, 0.7);
}
.win-btn.minimize {
  background: #febc2e;
  color: rgba(0, 0, 0, 0.4);
}
.win-btn.minimize:hover {
  color: rgba(0, 0, 0, 0.7);
}
.win-btn.maximize {
  background: #28c840;
  color: rgba(0, 0, 0, 0.4);
}
.win-btn.maximize:hover {
  color: rgba(0, 0, 0, 0.7);
}
</style>
