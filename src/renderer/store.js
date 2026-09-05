'use strict';
import { reactive } from 'vue';

// preload 注入的桥接对象；纯浏览器调试时可能为空
export const api = (typeof window !== 'undefined' && window.api) || null;

export const store = reactive({
  currentUser: null,
  settings: null,
});

// 可点头像（儿童登录无需输入）
export const AVATARS = ['🐰', '🐻', '🐱', '🐶', '🦊', '🐼', '🐸', '🦄', '🐯', '🐨'];

export const PARENT_PIN = '123456';

// 中文朗读（Electron 内置 TTS；优先使用中文女声）
let femaleVoice = null;
let voicesLoaded = false;

function loadVoices() {
  if (voicesLoaded || typeof window === 'undefined' || !window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;
  voicesLoaded = true;
  // 优先选择中文女声：按名称关键词匹配
  const femaleKeywords = ['female', 'woman', 'girl', 'xiaoxiao', 'yaoyao', 'huihui', 'tingting', 'sinji', 'meijia', 'sin-ji', '女', '晓晓', '瑶瑶', '慧慧', '婷婷'];
  const zhVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('zh'));
  // 先找中文女声
  for (const kw of femaleKeywords) {
    const found = zhVoices.find(v => v.name.toLowerCase().includes(kw.toLowerCase()));
    if (found) { femaleVoice = found; break; }
  }
  // 没找到明确女声，用第一个中文声音
  if (!femaleVoice && zhVoices.length > 0) {
    femaleVoice = zhVoices[0];
  }
}

// 某些浏览器异步加载声音列表
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function speak(text, opts = {}) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!voicesLoaded) loadVoices();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = opts.rate || 0.75;
    u.pitch = opts.pitch || 1.1; // 略高音调，更像儿童/女声
    if (femaleVoice) u.voice = femaleVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    /* 忽略：语音不可用不阻塞游戏 */
  }
}

// 朗读一段教学内容（逐句朗读，带停顿）
export function speakTeaching(parts) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!voicesLoaded) loadVoices();
    window.speechSynthesis.cancel();
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = 'zh-CN';
      u.rate = 0.7;
      u.pitch = 1.1;
      if (femaleVoice) u.voice = femaleVoice;
      window.speechSynthesis.speak(u);
    });
  } catch (e) {
    /* 忽略 */
  }
}

export const WAREHOUSE_NAMES = { 1: '刚认识', 2: '记得牢', 3: '很熟悉', 4: '永远记得' };
export const WAREHOUSE_COLORS = { 1: '#ffb347', 2: '#ffd34d', 3: '#7fd06b', 4: '#4bb3ff' };

export function pinyinOf(ch) {
  return (ch && ch.pinyin) || '';
}
