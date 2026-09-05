'use strict';
/**
 * 混合内容生成器：模板池 + 随机选字，生成词语/短语/句子。
 *
 * 核心规则：
 * 1. 生成的词句只包含 known（已认识）∪ test（本次待测）的字
 * 2. 必须包含至少一个 test 字（否则新字永远进不了学习流程）
 * 3. 模板按"所需固定功能字"分级，识字量越多可用模板越复杂
 * 4. 预留 AI 生成接口（setAIGenerator），未来可接本地小模型或云端 API
 *
 * 与固定词库（words.json）的关系：固定池优先，池中无候选时用本生成器兜底。
 */

// ---------- 模板池 ----------
// pattern 中 {A}{B}{C} 是内容空位，从 known∪test 中随机选字；
// fixed 是模板中的固定功能字，必须全部在 known 中才能使用该模板；
// minKnown 是使用该模板所需的最低识字量（粗略门槛）。
const TEMPLATES = [
  // ===== 双字词（word）=====
  // 常见构词模式（固定字+内容字），生成的词更通顺
  { type: 'word', pattern: '大{A}', fixed: ['大'], minKnown: 5 },
  { type: 'word', pattern: '小{A}', fixed: ['小'], minKnown: 5 },
  { type: 'word', pattern: '一{A}', fixed: ['一'], minKnown: 5 },
  { type: 'word', pattern: '{A}子', fixed: ['子'], minKnown: 15 },
  { type: 'word', pattern: '{A}儿', fixed: ['儿'], minKnown: 15 },
  { type: 'word', pattern: '{A}头', fixed: ['头'], minKnown: 15 },
  { type: 'word', pattern: '{A}人', fixed: ['人'], minKnown: 15 },
  { type: 'word', pattern: '{A}日', fixed: ['日'], minKnown: 15 },
  { type: 'word', pattern: '{A}月', fixed: ['月'], minKnown: 15 },
  { type: 'word', pattern: '{A}山', fixed: ['山'], minKnown: 15 },
  { type: 'word', pattern: '{A}水', fixed: ['水'], minKnown: 15 },
  { type: 'word', pattern: '{A}花', fixed: ['花'], minKnown: 15 },
  { type: 'word', pattern: '{A}鸟', fixed: ['鸟'], minKnown: 15 },
  { type: 'word', pattern: '{A}鱼', fixed: ['鱼'], minKnown: 15 },
  { type: 'word', pattern: '{A}马', fixed: ['马'], minKnown: 15 },
  { type: 'word', pattern: '{A}牛', fixed: ['牛'], minKnown: 15 },
  { type: 'word', pattern: '{A}羊', fixed: ['羊'], minKnown: 15 },
  { type: 'word', pattern: '{A}虫', fixed: ['虫'], minKnown: 15 },
  { type: 'word', pattern: '{A}云', fixed: ['云'], minKnown: 15 },
  { type: 'word', pattern: '{A}雨', fixed: ['雨'], minKnown: 15 },
  { type: 'word', pattern: '{A}风', fixed: ['风'], minKnown: 15 },
  { type: 'word', pattern: '{A}火', fixed: ['火'], minKnown: 15 },
  { type: 'word', pattern: '{A}石', fixed: ['石'], minKnown: 15 },
  { type: 'word', pattern: '{A}田', fixed: ['田'], minKnown: 15 },
  { type: 'word', pattern: '{A}禾', fixed: ['禾'], minKnown: 15 },
  { type: 'word', pattern: '{A}口', fixed: ['口'], minKnown: 15 },
  { type: 'word', pattern: '{A}手', fixed: ['手'], minKnown: 15 },
  { type: 'word', pattern: '{A}目', fixed: ['目'], minKnown: 15 },
  { type: 'word', pattern: '{A}耳', fixed: ['耳'], minKnown: 15 },
  { type: 'word', pattern: '红{A}', fixed: ['红'], minKnown: 20 },
  { type: 'word', pattern: '白{A}', fixed: ['白'], minKnown: 20 },
  { type: 'word', pattern: '黑{A}', fixed: ['黑'], minKnown: 20 },
  { type: 'word', pattern: '黄{A}', fixed: ['黄'], minKnown: 20 },
  { type: 'word', pattern: '绿{A}', fixed: ['绿'], minKnown: 20 },
  { type: 'word', pattern: '上{A}', fixed: ['上'], minKnown: 20 },
  { type: 'word', pattern: '下{A}', fixed: ['下'], minKnown: 20 },
  // 纯随机组合兜底（任何时候可用，但优先级低于上面的常见模式）
  { type: 'word', pattern: '{A}{B}', fixed: [], minKnown: 0 },

  // ===== 短语（phrase，3-5字）=====
  { type: 'phrase', pattern: '{A}的{B}', fixed: ['的'], minKnown: 30 },
  { type: 'phrase', pattern: '{A}和{B}', fixed: ['和'], minKnown: 30 },
  { type: 'phrase', pattern: '{A}在{B}', fixed: ['在'], minKnown: 50 },
  { type: 'phrase', pattern: '{A}有{B}', fixed: ['有'], minKnown: 50 },
  { type: 'phrase', pattern: '大{A}', fixed: ['大'], minKnown: 20 },
  { type: 'phrase', pattern: '小{A}', fixed: ['小'], minKnown: 20 },
  { type: 'phrase', pattern: '{A}里', fixed: ['里'], minKnown: 40 },
  { type: 'phrase', pattern: '{A}上', fixed: ['上'], minKnown: 40 },
  { type: 'phrase', pattern: '{A}下', fixed: ['下'], minKnown: 40 },
  { type: 'phrase', pattern: '一{A}', fixed: ['一'], minKnown: 20 },
  { type: 'phrase', pattern: '{A}是{B}', fixed: ['是'], minKnown: 80 },
  { type: 'phrase', pattern: '{A}里有{B}', fixed: ['里', '有'], minKnown: 100 },
  { type: 'phrase', pattern: '{A}上有{B}', fixed: ['上', '有'], minKnown: 100 },

  // ===== 短句（sentence，6-10字）=====
  { type: 'sentence', pattern: '{A}是{B}', fixed: ['是'], minKnown: 150 },
  { type: 'sentence', pattern: '{A}有{B}', fixed: ['有'], minKnown: 150 },
  { type: 'sentence', pattern: '{A}在{B}里', fixed: ['在', '里'], minKnown: 200 },
  { type: 'sentence', pattern: '{A}在{B}上', fixed: ['在', '上'], minKnown: 200 },
  { type: 'sentence', pattern: '{A}喜欢{B}', fixed: ['喜', '欢'], minKnown: 250 },
  { type: 'sentence', pattern: '{A}去{B}', fixed: ['去'], minKnown: 200 },
  { type: 'sentence', pattern: '{A}吃{B}', fixed: ['吃'], minKnown: 200 },
  { type: 'sentence', pattern: '{A}喝{B}', fixed: ['喝'], minKnown: 200 },
  { type: 'sentence', pattern: '{A}看{B}', fixed: ['看'], minKnown: 200 },
  { type: 'sentence', pattern: '{A}读{B}', fixed: ['读'], minKnown: 250 },
  { type: 'sentence', pattern: '{A}写{B}', fixed: ['写'], minKnown: 250 },
  { type: 'sentence', pattern: '{A}画{B}', fixed: ['画'], minKnown: 250 },
  { type: 'sentence', pattern: '{A}唱{B}', fixed: ['唱'], minKnown: 300 },
  { type: 'sentence', pattern: '{A}跳{B}', fixed: ['跳'], minKnown: 300 },
  { type: 'sentence', pattern: '{A}跑{B}', fixed: ['跑'], minKnown: 300 },
  { type: 'sentence', pattern: '{A}飞{B}', fixed: ['飞'], minKnown: 300 },
  { type: 'sentence', pattern: '{A}游{B}', fixed: ['游'], minKnown: 300 },
  { type: 'sentence', pattern: '{A}在{B}里{C}', fixed: ['在', '里'], minKnown: 400 },
  { type: 'sentence', pattern: '{A}在{B}上{C}', fixed: ['在', '上'], minKnown: 400 },
  { type: 'sentence', pattern: '{A}和{B}一起{C}', fixed: ['和', '一', '起'], minKnown: 500 },
  { type: 'sentence', pattern: '{A}的{B}很{C}', fixed: ['的', '很'], minKnown: 500 },
  { type: 'sentence', pattern: '今天{A}去{B}', fixed: ['今', '天', '去'], minKnown: 600 },
  { type: 'sentence', pattern: '{A}是一个{B}', fixed: ['是', '一', '个'], minKnown: 600 },
  { type: 'sentence', pattern: '{A}有一个{B}', fixed: ['有', '一', '个'], minKnown: 600 },
];

// ---------- AI 生成器接口（预留） ----------
// 未来可注入：本地小模型（Transformers.js + Qwen2.5-0.5B ONNX）
// 或云端 API（豆包/通义千问）。接口约定：
//   aiGenerator.generate(knownSet, testSet, maxType, count)
//     → Promise<Array<{ text: string, type: 'word'|'phrase'|'sentence' }>>
let aiGenerator = null;

/**
 * 注入 AI 生成器（可选）。
 * 注入后优先使用 AI 生成；AI 生成失败或为空时回退模板生成。
 * @param {{generate: Function}} gen
 */
function setAIGenerator(gen) {
  if (gen && typeof gen.generate === 'function') {
    aiGenerator = gen;
  }
}

// ---------- 工具函数 ----------
function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 从 pattern 中提取空位名，如 '{A}的{B}' → ['A','B'] */
function extractSlots(pattern) {
  const matches = pattern.match(/\{([A-Z])\}/g);
  return matches ? matches.map((m) => m[1]) : [];
}

/**
 * 筛选当前可用的模板：
 * - fixed 字全部在 known 中
 * - minKnown ≤ known.size
 * - type 权重 ≤ maxType
 */
function availableTemplates(knownSet, maxType) {
  const typeWeight = { char: 1, word: 2, phrase: 3, sentence: 4 };
  const maxW = typeWeight[maxType] || 4;
  return TEMPLATES.filter((t) => {
    if (typeWeight[t.type] > maxW) return false;
    if (knownSet.size < t.minKnown) return false;
    return t.fixed.every((ch) => knownSet.has(ch));
  });
}

/**
 * 用模板生成一条词句。
 * @param {Set<string>} knownSet 已认识字集合
 * @param {Set<string>} testSet 本次待测字集合
 * @param {{type:string,pattern:string,fixed:string[]}} template
 * @param {function} [rng] 随机源
 * @returns {{text:string,type:string,chars:string[]}|null}
 */
function fillTemplate(knownSet, testSet, template, rng = Math.random) {
  const slots = extractSlots(template.pattern);
  if (slots.length === 0) return null;

  // 候选字 = known ∪ test
  const candidates = [...new Set([...knownSet, ...testSet])];
  if (candidates.length === 0) return null;

  // test 字列表（必须至少一个空位填入 test 字）
  const testChars = [...testSet];
  if (testChars.length === 0) return null;

  // 随机决定哪个空位填 test 字（至少一个）
  const testSlotIndex = Math.floor(rng() * slots.length);

  const slotValues = {};
  const usedChars = new Set();

  for (let i = 0; i < slots.length; i++) {
    const slotName = slots[i];
    let chosen;
    if (i === testSlotIndex) {
      // 这个位置必须填 test 字
      const available = testChars.filter((c) => !usedChars.has(c));
      if (available.length === 0) {
        // test 字不够，允许重复（但尽量不重复）
        chosen = testChars[Math.floor(rng() * testChars.length)];
      } else {
        chosen = available[Math.floor(rng() * available.length)];
      }
    } else {
      // 其他位置从 candidates 中选，尽量不重复
      const available = candidates.filter((c) => !usedChars.has(c));
      if (available.length === 0) {
        chosen = candidates[Math.floor(rng() * candidates.length)];
      } else {
        chosen = available[Math.floor(rng() * available.length)];
      }
    }
    slotValues[slotName] = chosen;
    usedChars.add(chosen);
  }

  // 填入模板
  let text = template.pattern;
  for (const slotName of slots) {
    text = text.replace(`{${slotName}}`, slotValues[slotName]);
  }

  // 提取所有汉字（去掉可能的标点）
  const chars = Array.from(text).filter((c) => /\p{Script=Han}/u.test(c));

  // 验证：所有字都在 known ∪ test 中，且至少包含一个 test 字
  const allValid = chars.every((c) => knownSet.has(c) || testSet.has(c));
  const hasTest = chars.some((c) => testSet.has(c));
  if (!allValid || !hasTest) return null;

  return { text, type: template.type, chars };
}

// ---------- 主生成函数 ----------
/**
 * 生成词句列表。
 * @param {Set<string>} knownSet 已认识字集合
 * @param {Set<string>} testSet 本次待测字集合
 * @param {string} maxType 当前载体上限（char/word/phrase/sentence）
 * @param {number} count 生成数量
 * @param {function} [rng] 随机源（测试注入）
 * @returns {Array<{text:string,type:string,chars:string[]}>}
 */
function generateItems(knownSet, testSet, maxType, count, rng = Math.random) {
  if (!knownSet || !testSet || testSet.size === 0) return [];

  const templates = availableTemplates(knownSet, maxType);
  if (templates.length === 0) return [];

  const results = [];
  const seenTexts = new Set();
  let attempts = 0;
  const maxAttempts = count * 20; // 防止死循环

  while (results.length < count && attempts < maxAttempts) {
    attempts++;
    const template = templates[Math.floor(rng() * templates.length)];
    const item = fillTemplate(knownSet, testSet, template, rng);
    if (item && !seenTexts.has(item.text)) {
      seenTexts.add(item.text);
      results.push(item);
    }
  }

  return results;
}

/**
 * 异步生成（优先 AI，回退模板）。
 * 当注入了 AI 生成器时调用此方法；否则直接用 generateItems。
 * @param {Set<string>} knownSet
 * @param {Set<string>} testSet
 * @param {string} maxType
 * @param {number} count
 * @param {function} [rng]
 * @returns {Promise<Array>}
 */
async function generateItemsAsync(knownSet, testSet, maxType, count, rng = Math.random) {
  if (aiGenerator) {
    try {
      const aiResults = await aiGenerator.generate(knownSet, testSet, maxType, count);
      if (Array.isArray(aiResults) && aiResults.length > 0) {
        // 过滤 AI 结果：确保只包含 known∪test 且至少一个 test 字
        const valid = aiResults.filter((item) => {
          if (!item || !item.text) return false;
          const chars = Array.from(item.text).filter((c) => /\p{Script=Han}/u.test(c));
          const allValid = chars.every((c) => knownSet.has(c) || testSet.has(c));
          const hasTest = chars.some((c) => testSet.has(c));
          return allValid && hasTest;
        });
        if (valid.length > 0) {
          return valid.map((item) => ({
            text: item.text,
            type: item.type || 'sentence',
            chars: Array.from(item.text).filter((c) => /\p{Script=Han}/u.test(c)),
          }));
        }
      }
    } catch (e) {
      // AI 生成失败，静默回退模板
      console.warn('[content-generator] AI 生成失败，回退模板：', e.message);
    }
  }
  return generateItems(knownSet, testSet, maxType, count, rng);
}

module.exports = {
  generateItems,
  generateItemsAsync,
  setAIGenerator,
  TEMPLATES,
  availableTemplates,
  fillTemplate,
};
