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

// ===== Piper TTS 语音合成（优先）=====
let currentAudio = null;
let currentTempFile = null;
let ttsAvailable = null; // null=未检测, true=可用, false=不可用

// 检测 Piper TTS 是否可用
async function checkTTS() {
  if (ttsAvailable !== null) return ttsAvailable;
  try {
    if (api && api.tts && api.tts.synthesize) {
      const result = await api.tts.synthesize('测试', { speed: 1.0 });
      if (result && result.filePath) {
        // 清理测试文件
        api.tts.cleanup(result.filePath);
        ttsAvailable = true;
        return true;
      }
    }
  } catch (e) {
    console.warn('Piper TTS 不可用，回退到系统语音:', e.message);
  }
  ttsAvailable = false;
  return false;
}

// 停止当前播放
function stopAudio() {
  if (currentAudio) {
    try { currentAudio.pause(); } catch (e) {}
    currentAudio = null;
  }
  if (currentTempFile && api && api.tts) {
    api.tts.cleanup(currentTempFile);
    currentTempFile = null;
  }
}

// 使用 Piper TTS 播放文本
async function playWithPiper(text, opts = {}) {
  try {
    stopAudio();
    const result = await api.tts.synthesize(text, {
      speed: opts.speed || 0.85,
      volume: opts.volume || 1.0,
    });
    if (!result || !result.filePath) return false;

    currentTempFile = result.filePath;
    const audio = new Audio('file://' + result.filePath);
    currentAudio = audio;

    audio.onended = () => {
      if (currentTempFile && api && api.tts) {
        api.tts.cleanup(currentTempFile);
        currentTempFile = null;
      }
      currentAudio = null;
    };
    audio.onerror = () => {
      if (currentTempFile && api && api.tts) {
        api.tts.cleanup(currentTempFile);
        currentTempFile = null;
      }
      currentAudio = null;
    };

    await audio.play();
    return true;
  } catch (e) {
    console.warn('Piper TTS 播放失败:', e.message);
    return false;
  }
}

// ===== Web Speech API 兜底 =====
let femaleVoice = null;
let voicesLoaded = false;

function loadVoices() {
  if (voicesLoaded || typeof window === 'undefined' || !window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;
  voicesLoaded = true;
  const zhCNVoices = voices.filter(v => {
    if (!v.lang) return false;
    const lang = v.lang.toLowerCase();
    return lang === 'zh-cn' || lang.startsWith('zh_cn');
  });
  const femaleKeywords = ['female', 'woman', 'girl', 'xiaoxiao', 'yaoyao', 'huihui', 'tingting', 'meijia', '晓晓', '瑶瑶', '慧慧', '婷婷', '小燕', '小云', '小美'];
  for (const kw of femaleKeywords) {
    const found = zhCNVoices.find(v => v.name.toLowerCase().includes(kw.toLowerCase()));
    if (found) { femaleVoice = found; break; }
  }
  if (!femaleVoice && zhCNVoices.length > 0) {
    femaleVoice = zhCNVoices[0];
  }
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function speakWithWebSpeech(text, opts = {}) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!voicesLoaded) loadVoices();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    // 适合小朋友的朗读参数：略高音调（更活泼有童趣）、略慢语速（更清晰）
    u.rate = opts.rate || 0.85;
    u.pitch = opts.pitch || 1.25;
    u.volume = opts.volume || 1.0;
    if (femaleVoice) u.voice = femaleVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    /* 忽略 */
  }
}

// ===== 对外接口 =====

/**
 * 朗读文本（使用系统 Web Speech API 中文女声）
 */
export function speak(text, opts = {}) {
  if (!text || !text.trim()) return;
  speakWithWebSpeech(text, opts);
}

/**
 * 朗读教学内容（字、组词、造句拼接成一段，每段中间加句号）
 */
export function speakTeaching(parts) {
  const text = parts.filter(Boolean).join('。');
  if (!text) return;
  speak(text, { rate: 0.85 });
}

/**
 * 停止所有朗读
 */
export function stopSpeaking() {
  stopAudio();
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export const WAREHOUSE_NAMES = { 1: '刚认识', 2: '记得牢', 3: '很熟悉', 4: '永远记得' };
export const WAREHOUSE_COLORS = { 1: '#ffb347', 2: '#ffd34d', 3: '#7fd06b', 4: '#4bb3ff' };

export function pinyinOf(ch) {
  return (ch && ch.pinyin) || '';
}
