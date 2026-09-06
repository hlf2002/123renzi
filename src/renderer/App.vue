<template>
  <div class="app-root">
    <WindowControls class="global-window-controls" />
    <router-view />
  </div>
</template>

<script setup>
import WindowControls from './components/WindowControls.vue';
</script>

<style>
/* 全局：整个应用空白区域可拖拽 */
.app-root {
  -webkit-app-region: drag;
  min-height: 100vh;
}
/* 所有交互元素不可拖拽 */
button, a, input, textarea, select, [role="button"], .char-cell, .ware, .modal-box {
  -webkit-app-region: no-drag;
}

/* 窗口控制按钮固定在左上角 */
.global-window-controls {
  position: fixed;
  top: 12px;
  left: 14px;
  z-index: 99999;
}

/* 给页面顶部留出空间，避免内容被窗口按钮遮挡 */
#app {
  padding-top: 0;
}
</style>
