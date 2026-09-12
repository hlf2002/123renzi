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
      <div class="pet">{{ PETS[w] }}</div>
      <img class="house-img" :src="HOUSES[w]" :alt="names[w]" />
      <!-- 门牌文字叠在图底部空白标签条上 -->
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
// seedream 生成的 3D 小房子素材
const HOUSES = {
  1: 'warehouses/house-1.png',
  2: 'warehouses/house-2.png',
  3: 'warehouses/house-3.png',
  4: 'warehouses/house-4.png',
};
// 屋顶小动物
const PETS = { 1: '🦕', 2: '🦖', 3: '🐨', 4: '🐸' };
</script>

<style scoped>
.warehouse-bar {
  display: flex;
  justify-content: center;
  gap: 14px;
  width: 100%;
  padding: 0 16px;
  box-sizing: border-box;
}
.house {
  flex: 1;
  max-width: 190px;
  position: relative;
  cursor: pointer;
  transition: transform 0.15s;
}
.house:hover { transform: translateY(-3px); }

/* 房子图：已抠成透明 PNG */
.house-img {
  width: 100%;
  display: block;
}
/* 屋顶小动物 */
.pet {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 26px;
  z-index: 2;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,0.15));
}
/* 门牌：叠在图底部空白标签条上 */
.plate {
  position: absolute;
  left: 50%;
  bottom: 12%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 2;
}
.w-name {
  font-size: 13px;
  font-weight: 800;
  color: #5a4630;
  line-height: 1.2;
}
.w-num {
  font-size: 15px;
  font-weight: 800;
  color: #5a4630;
  margin-top: 1px;
}
</style>
