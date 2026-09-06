<template>
  <div class="app-root">
    <router-view />
  </div>
</template>

<script setup>
// 全局入口
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
</style>
