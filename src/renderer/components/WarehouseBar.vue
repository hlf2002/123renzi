<template>
  <div class="warehouse-bar">
    <div
      v-for="w in [1, 2, 3, 4]"
      :key="w"
      class="ware"
      :style="{ borderColor: colors[w], background: w === active ? colors[w] + '33' : '#fff' }"
      :title="names[w]"
      @click="$emit('select', w)"
    >
      <div class="w-name" :style="{ color: colors[w] }">{{ names[w] }}</div>
      <div class="w-num">{{ counts[w] || 0 }} 字</div>
    </div>
  </div>
</template>

<script setup>
import { WAREHOUSE_NAMES, WAREHOUSE_COLORS } from '../store';
defineProps({
  counts: { type: Object, required: true },
  active: { type: Number, default: 0 },
});
defineEmits(['select']);
const names = WAREHOUSE_NAMES;
const colors = WAREHOUSE_COLORS;
</script>

<style scoped>
.warehouse-bar {
  display: flex;
  gap: 10px;
  width: 100%;
}
.ware {
  flex: 1;
  border: 3px solid;
  border-radius: 16px;
  padding: 8px 6px;
  text-align: center;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.ware:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}
.ware:active {
  transform: translateY(0);
}
.w-name { font-size: 13px; font-weight: 700; }
.w-num { font-size: 15px; font-weight: 800; color: #5a4630; margin-top: 2px; }
</style>
