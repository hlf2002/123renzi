<template>
  <div class="learn-card" :style="{ background: bg }">
    <div class="lc-char" @click="say">{{ char.hanzi }}</div>
    <div class="lc-pinyin">{{ char.pinyin || '·' }}</div>
    <button class="lc-btn" @click="say">🔊 再听一遍</button>
    <div class="lc-encourage">{{ encourage }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { speak } from '../store';

const props = defineProps({ char: { type: Object, required: true } });
const bg = '#fff3d6';
const encourage = computed(() => {
  const tips = ['你真棒！这个字会了！', '记住啦，明天还会见到它！', '哇，又学会一个字！', '继续加油，越来越厉害！'];
  return tips[Math.floor(Math.random() * tips.length)];
});
function say() {
  speak(props.char.hanzi);
}
</script>

<style scoped>
.learn-card {
  border-radius: 24px;
  padding: 28px 20px;
  text-align: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}
.lc-char {
  font-size: 96px;
  font-weight: 900;
  color: #d94f2b;
  line-height: 1.2;
  cursor: pointer;
}
.lc-pinyin {
  font-size: 28px;
  color: #8a6d3b;
  margin: 6px 0 14px;
  letter-spacing: 2px;
}
.lc-btn {
  background: #ffb347;
  color: #fff;
  border: none;
  border-radius: 20px;
  padding: 10px 22px;
  font-size: 16px;
  font-weight: 700;
}
.lc-encourage {
  margin-top: 14px;
  color: #b0761f;
  font-size: 16px;
  font-weight: 600;
}
</style>
