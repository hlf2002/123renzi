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
  // 只选普通话（zh-CN），排除粤语(zh-HK)、台湾国语(zh-TW)等
  const zhCNVoices = voices.filter(v => {
    if (!v.lang) return false;
    const lang = v.lang.toLowerCase();
    return lang === 'zh-cn' || lang.startsWith('zh_cn') || lang.startsWith('zh-cn');
  });
  // 优先选择中文女声：按名称关键词匹配
  const femaleKeywords = ['female', 'woman', 'girl', 'xiaoxiao', 'yaoyao', 'huihui', 'tingting', 'meijia', '晓晓', '瑶瑶', '慧慧', '婷婷', '小燕', '小云', '小美'];
  // 先找普通话女声
  for (const kw of femaleKeywords) {
    const found = zhCNVoices.find(v => v.name.toLowerCase().includes(kw.toLowerCase()));
    if (found) { femaleVoice = found; break; }
  }
  // 没找到明确女声，用第一个普通话声音
  if (!femaleVoice && zhCNVoices.length > 0) {
    femaleVoice = zhCNVoices[0];
  }
  // 最后兜底：所有中文声音中找女声（但仍优先普通话）
  if (!femaleVoice) {
    const allZh = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('zh'));
    for (const kw of femaleKeywords) {
      const found = allZh.find(v => v.name.toLowerCase().includes(kw.toLowerCase()));
      if (found) { femaleVoice = found; break; }
    }
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

// 朗读一段教学内容（拼接成一段文本朗读，避免多utterance排队问题）
export function speakTeaching(parts) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!voicesLoaded) loadVoices();
    // 拼接成一段文本，用逗号分隔各部分
    const text = parts.filter(Boolean).join('，');
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.7;
    u.pitch = 1.1;
    if (femaleVoice) u.voice = femaleVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    /* 忽略 */
  }
}

export const WAREHOUSE_NAMES = { 1: '刚认识', 2: '记得牢', 3: '很熟悉', 4: '永远记得' };
export const WAREHOUSE_COLORS = { 1: '#ffb347', 2: '#ffd34d', 3: '#7fd06b', 4: '#4bb3ff' };

export function pinyinOf(ch) {
  return (ch && ch.pinyin) || '';
}
