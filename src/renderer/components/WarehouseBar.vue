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
      <!-- 屋顶上的小动物 -->
      <div class="pet">{{ PETS[w] }}</div>
      <!-- 屋顶 -->
      <div class="roof" :style="{ background: darken(colors[w]) }"></div>
      <!-- 房体 -->
      <div class="body" :style="{ background: colors[w] }">
        <!-- 拱形开口：里面露出几张字卡 -->
        <div class="opening">
          <span class="card" v-for="i in 3" :key="i"></span>
        </div>
        <!-- 门牌：仓库名 + 字数 -->
        <div class="doorplate">
          <div class="w-name">{{ names[w] }}</div>
          <div class="w-num">{{ counts[w] || 0 }} 字</div>
        </div>
      </div>
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
// 每间房子屋顶上趴着的小动物
const PETS = { 1: '🦕', 2: '🦖', 3: '🐨', 4: '🐸' };
// 屋顶颜色：比房体深一点
function darken(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 35);
  const g = Math.max(0, ((n >> 8) & 255) - 35);
  const b = Math.max(0, (n & 255) - 35);
  return `rgb(${r},${g},${b})`;
}
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
  max-width: 220px;
  position: relative;
  cursor: pointer;
  transition: transform 0.15s;
}
.house:hover { transform: translateY(-3px); }
.house.active .body { box-shadow: 0 0 0 3px #fff, 0 6px 14px rgba(0,0,0,0.12); }

/* 屋顶：弧形三角 */
.roof {
  width: 78%;
  height: 26px;
  margin: 0 auto;
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
  position: relative;
  z-index: 1;
}
/* 小动物趴在屋顶上 */
.pet {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 26px;
  z-index: 2;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,0.15));
}
/* 房体 */
.body {
  border-radius: 14px;
  padding: 12px 10px 10px;
  margin-top: -4px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.08);
  text-align: center;
}
/* 拱形开口：露出字卡 */
.opening {
  height: 62px;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 36px 36px 8px 8px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 5px;
  padding: 0 10px 8px;
  box-sizing: border-box;
}
.card {
  width: 16px;
  height: 20px;
  background: #fff;
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.12);
}
/* 门牌：名字 + 字数 */
.doorplate {
  margin-top: 8px;
}
.w-name {
  display: inline-block;
  background: rgba(255, 255, 255, 0.85);
  color: #5a4630;
  font-size: 13px;
  font-weight: 800;
  border-radius: 8px;
  padding: 2px 10px;
}
.w-num {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 800;
  color: #5a4630;
}
</style>
