<template>
  <div class="warehouse-bar">
    <div
      v-for="w in [1, 2, 3, 4]"
      :key="w"
      class="house"
      :class="{ active: w === active }"
      :title="names[w]"
      @click="$emit('select', w)"
    >
      <img class="house-img" :src="HOUSES[w]" :alt="names[w]" />
      <!-- 仓库名+字数，印在房体底部 -->
      <div class="plate">
        <div class="w-name">{{ names[w] }}</div>
        <div class="w-num">{{ counts[w] || 0 }} 字</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { WAREHOUSE_NAMES } from '../store';
defineProps({
  counts: { type: Object, required: true },
  active: { type: Number, default: 0 },
});
defineEmits(['select']);
const names = WAREHOUSE_NAMES;
// seedream 生成的 3D 小房子素材（已抠透明，自带屋顶小恐龙）
const HOUSES = {
  1: 'warehouses/house-1.png',
  2: 'warehouses/house-2.png',
  3: 'warehouses/house-3.png',
  4: 'warehouses/house-4.png',
};
</script>

<style scoped>
.warehouse-bar {
  display: flex;
  justify-content: center;
  gap: 18px;
  width: 100%;
  padding: 0 20px;
  box-sizing: border-box;
}
.house {
  flex: 1;
  max-width: 240px;
  position: relative;
  cursor: pointer;
  transition: transform 0.15s;
}
.house:hover { transform: translateY(-3px); }
.house-img {
  width: 100%;
  display: block;
}
/* 门牌：白色粗体印在房体底部 */
.plate {
  position: absolute;
  left: 50%;
  bottom: 19%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 2;
}
.w-name {
  font-size: 18px;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.15);
  line-height: 1.2;
}
.w-num {
  font-size: 16px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.15);
  margin-top: 2px;
}
</style>
