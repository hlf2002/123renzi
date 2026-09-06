<template>
  <div class="app-root">
    <router-view />
  </div>
</template>

<script setup>
// 全局入口
</script>

<style>
/* 全局自定义淡绿色大光标，所有元素都使用 */
* {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Cpath d='M5 5 L5 27 L11 20 L15 31 L19 29 L15 18 L24 18 Z' fill='%2352c41a' stroke='%23ffffff' stroke-width='2.5' stroke-linejoin='round'/%3E%3C/svg%3E") 5 5, auto !important;
}
/* 整个应用空白区域可拖拽 */
.app-root {
  -webkit-app-region: drag;
  min-height: 100vh;
}
/* 所有交互元素不可拖拽 */
button, a, input, textarea, select, [role="button"], .char-cell, .ware, .modal-box, .char-card {
  -webkit-app-region: no-drag;
}
</style>
