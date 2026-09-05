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

// 中文朗读（Electron 内置 TTS；无语音包时静默失败，不影响使用）
export function speak(text) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.75;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    /* 忽略：语音不可用不阻塞游戏 */
  }
}

export const WAREHOUSE_NAMES = { 1: '刚认识', 2: '记得牢', 3: '很熟悉', 4: '永远记得' };
export const WAREHOUSE_COLORS = { 1: '#ffb347', 2: '#ffd34d', 3: '#7fd06b', 4: '#4bb3ff' };

export function pinyinOf(ch) {
  return (ch && ch.pinyin) || '';
}
