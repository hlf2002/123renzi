<template>
  <div class="learn-card" :style="{ background: bg }">
    <!-- 汉字 + 拼音 -->
    <div class="lc-char" @click="sayChar">{{ teaching.hanzi || char.hanzi }}</div>
    <div class="lc-pinyin">{{ teaching.pinyin || char.pinyin || '·' }}</div>

    <!-- 加载中 -->
    <div v-if="loading" class="lc-loading">正在准备教学内容...</div>

    <!-- 教学内容 -->
    <div v-else class="lc-content">
      <!-- 字义解释 -->
      <div class="lc-section" v-if="teaching.meaning">
        <div class="lc-label">📖 字义</div>
        <div class="lc-text">{{ teaching.meaning }}</div>
      </div>

      <!-- 组词 -->
      <div class="lc-section" v-if="teaching.words && teaching.words.length > 0">
        <div class="lc-label">🔤 组词</div>
        <div class="lc-words">
          <span
            v-for="(w, i) in teaching.words"
            :key="i"
            class="lc-word-tag"
            @click="sayText(w.word)"
          >{{ w.word }}</span>
        </div>
      </div>

      <!-- 造句 -->
      <div class="lc-section" v-if="teaching.exampleSentence">
        <div class="lc-label">✏️ 造句</div>
        <div class="lc-text lc-sentence" @click="sayText(teaching.exampleSentence)">
          {{ teaching.exampleSentence }}
        </div>
      </div>

      <!-- 用法 -->
      <div class="lc-section" v-if="teaching.usage">
        <div class="lc-label">💡 用法</div>
        <div class="lc-text lc-usage">{{ teaching.usage }}</div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="lc-actions">
      <button class="lc-btn lc-btn-primary" @click="sayAll" :disabled="loading">
        🔊 听完整讲解
      </button>
      <button class="lc-btn" @click="sayChar" :disabled="loading">
        🔊 再读一遍字
      </button>
    </div>

    <div class="lc-encourage">{{ encourage }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { speak, speakTeaching, api } from '../store';

const props = defineProps({
  char: { type: Object, required: true },
  currentSentence: { type: String, default: '' },
});

const bg = '#fff3d6';
const loading = ref(true);
const teaching = ref({});

const encourage = computed(() => {
  const tips = ['你真棒！这个字会了！', '记住啦，明天还会见到它！', '哇，又学会一个字！', '继续加油，越来越厉害！', '认真学习的孩子最可爱！'];
  return tips[Math.floor(Math.random() * tips.length)];
});

async function loadTeaching() {
  loading.value = true;
  try {
    if (api && api.teacher && api.teacher.teach) {
      const result = await api.teacher.teach(
        { hanzi: props.char.hanzi, pinyin: props.char.pinyin },
        { currentSentence: props.currentSentence }
      );
      teaching.value = result || {};
    } else {
      // 浏览器调试时无 IPC，用简化内容
      teaching.value = {
        hanzi: props.char.hanzi,
        pinyin: props.char.pinyin,
        meaning: `这个字读「${props.char.pinyin || props.char.hanzi}」，是一个常用汉字。`,
        words: [],
        exampleSentence: props.currentSentence || '',
        usage: '',
      };
    }
  } catch (e) {
    teaching.value = {
      hanzi: props.char.hanzi,
      pinyin: props.char.pinyin,
      meaning: `这个字读「${props.char.pinyin || props.char.hanzi}」。`,
      words: [],
      exampleSentence: props.currentSentence || '',
      usage: '',
    };
  }
  loading.value = false;
}

function sayChar() {
  speak(props.char.hanzi, { rate: 0.6 });
}

function sayText(text) {
  if (text) speak(text, { rate: 0.7 });
}

function sayAll() {
  if (teaching.value.speakParts && teaching.value.speakParts.length > 0) {
    speakTeaching(teaching.value.speakParts);
  } else {
    // 兜底：逐段朗读
    const parts = [
      `${props.char.hanzi}，读${props.char.pinyin || props.char.hanzi}。`,
      teaching.value.meaning,
      teaching.value.words && teaching.value.words.length > 0 ? `组词：${teaching.value.words.map(w => w.word).join('、')}。` : '',
      teaching.value.exampleSentence ? `例句：${teaching.value.exampleSentence}。` : '',
      teaching.value.usage,
    ].filter(Boolean);
    speakTeaching(parts);
  }
}

onMounted(() => {
  loadTeaching();
  // 延迟自动朗读完整教学内容
  setTimeout(() => sayAll(), 500);
});

watch(() => props.char.hanzi, () => {
  loadTeaching();
  setTimeout(() => sayAll(), 500);
});
</script>

<style scoped>
.learn-card {
  border-radius: 24px;
  padding: 24px 20px;
  text-align: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  max-height: 80vh;
  overflow-y: auto;
}
.lc-char {
  font-size: 88px;
  font-weight: 900;
  color: #d94f2b;
  line-height: 1.1;
  cursor: pointer;
}
.lc-pinyin {
  font-size: 26px;
  color: #8a6d3b;
  margin: 4px 0 12px;
  letter-spacing: 2px;
}
.lc-loading {
  color: #b0761f;
  font-size: 15px;
  padding: 12px 0;
}
.lc-content {
  text-align: left;
  margin: 8px 0;
}
.lc-section {
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  padding: 10px 14px;
}
.lc-label {
  font-size: 14px;
  font-weight: 700;
  color: #b0761f;
  margin-bottom: 6px;
}
.lc-text {
  font-size: 16px;
  color: #5a4a2a;
  line-height: 1.6;
}
.lc-sentence {
  cursor: pointer;
  color: #2b6cb0;
  font-weight: 600;
}
.lc-usage {
  font-size: 14px;
  color: #7a6a4a;
}
.lc-words {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.lc-word-tag {
  background: #ffd34d;
  color: #7a5a1a;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s;
}
.lc-word-tag:hover {
  transform: scale(1.08);
}
.lc-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin: 14px 0 8px;
  flex-wrap: wrap;
}
.lc-btn {
  background: #ffb347;
  color: #fff;
  border: none;
  border-radius: 20px;
  padding: 10px 20px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s;
}
.lc-btn:hover {
  transform: scale(1.05);
}
.lc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.lc-btn-primary {
  background: #4bb3ff;
}
.lc-encourage {
  margin-top: 10px;
  color: #b0761f;
  font-size: 15px;
  font-weight: 600;
}
</style>
