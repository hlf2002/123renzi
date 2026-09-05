'use strict';
/**
 * 汉字教学内容生成器：读字、组词、解释、造句、用法。
 *
 * 数据源：
 * - 组词：从 words.json 中提取包含该字的常用词（优先短词、高频词）
 * - 造句：从 sentences.json 中提取包含该字的儿童句子
 * - 解释/用法：首版用简化模板；预留 AI 接口（setAITeacher），
 *   未来接入大模型后可生成准确的字义解释和用法说明。
 */
const fs = require('fs');
const path = require('path');

let _words = null;
let _sentences = null;
let _dataDir = null;

// AI 教学内容生成器接口（预留）
// interface AITeacher { generate(hanzi, context): Promise<{meaning, usage}> }
let aiTeacher = null;

function init(dataDir) {
  _dataDir = dataDir;
}

function loadWords() {
  if (_words) return _words;
  if (!_dataDir) return [];
  try {
    _words = JSON.parse(fs.readFileSync(path.join(_dataDir, 'words.json'), 'utf8'));
  } catch (e) {
    _words = [];
  }
  return _words;
}

function loadSentences() {
  if (_sentences) return _sentences;
  if (!_dataDir) return [];
  try {
    _sentences = JSON.parse(fs.readFileSync(path.join(_dataDir, 'sentences.json'), 'utf8'));
  } catch (e) {
    _sentences = [];
  }
  return _sentences;
}

/**
 * 组词：从词库中提取包含该字的常用词，优先短词（2-3字）。
 * @param {string} hanzi
 * @param {number} count
 * @returns {Array<{word:string,type:string}>}
 */
function getWords(hanzi, count = 3) {
  const words = loadWords();
  const candidates = words
    .filter((w) => w.chars && w.chars.includes(hanzi))
    .sort((a, b) => a.chars.length - b.chars.length); // 短词优先
  return candidates.slice(0, count).map((w) => ({ word: w.text, type: w.type }));
}

/**
 * 造句：从句子库中提取包含该字的儿童句子。
 * @param {string} hanzi
 * @param {number} count
 * @returns {Array<string>}
 */
function getSentences(hanzi, count = 2) {
  const sentences = loadSentences();
  const candidates = sentences.filter((s) => s.text && s.text.includes(hanzi));
  return candidates.slice(0, count).map((s) => s.text);
}

/**
 * 简化字义解释模板（首版）。
 * 未来接入 AI 后用 AI 生成准确解释。
 * @param {string} hanzi
 * @param {string} pinyin
 * @returns {string}
 */
function getMeaning(hanzi, pinyin) {
  const py = pinyin || '';
  // 常见字的简化解释（覆盖最高频的100字）
  const commonMeanings = {
    '一': '数字，表示最小的正整数',
    '二': '数字，一加一的和',
    '三': '数字，二加一的和',
    '四': '数字，三加一的和',
    '五': '数字，四加一的和',
    '六': '数字，五加一的和',
    '七': '数字，六加一的和',
    '八': '数字，七加一的和',
    '九': '数字，八加一的和',
    '十': '数字，九加一的和',
    '人': '能制造工具并使用工具进行劳动的高等动物',
    '口': '嘴，人和动物吃东西和发声的器官',
    '手': '人体上肢前端能拿东西的部分',
    '目': '眼睛',
    '耳': '听觉器官',
    '日': '太阳；白天',
    '月': '月亮；计时单位',
    '水': '无色无味的液体，生命之源',
    '火': '物体燃烧时发出的光和热',
    '山': '地面上由土石构成的高耸部分',
    '石': '构成地壳的矿物质硬块',
    '田': '种植农作物的土地',
    '禾': '谷类植物的统称',
    '虫': '昆虫和类似昆虫的小动物',
    '云': '天空中悬浮的水滴或冰晶聚集物',
    '雨': '从云层中降向地面的水',
    '雪': '天空中飘落的白色结晶',
    '风': '空气流动的现象',
    '花': '植物的繁殖器官，有各种颜色和形状',
    '鸟': '脊椎动物的一纲，有羽毛，会飞',
    '鱼': '生活在水中的脊椎动物，用鳃呼吸',
    '马': '哺乳动物，四肢强健，善跑',
    '牛': '哺乳动物，头上有角，能耕地产奶',
    '羊': '哺乳动物，头上有角，毛可做衣服',
    '大': '在体积、面积、数量等方面超过一般',
    '小': '在体积、面积、数量等方面不及一般',
    '上': '位置在高处的',
    '下': '位置在低处的',
    '多': '数量大',
    '少': '数量小',
    '来': '从别的地方到说话人所在的地方',
    '去': '从所在地到别的地方',
    '开': '使关闭着的东西不再关闭',
    '关': '使开着的物体合拢',
    '好': '优点多的，使人满意的',
    '坏': '品质恶劣，有害的',
    '我': '自称，自己',
    '你': '称对方',
    '他': '称自己和对方以外的男性',
    '她': '称自己和对方以外的女性',
    '它': '称人以外的事物',
    '们': '用在代词或指人的名词后面表示复数',
    '爸': '父亲',
    '妈': '母亲',
    '哥': '哥哥，同父母或同辈而年纪比自己大的男子',
    '弟': '弟弟，同父母或同辈而年纪比自己小的男子',
    '姐': '姐姐，同父母或同辈而年纪比自己大的女子',
    '妹': '妹妹，同父母或同辈而年纪比自己小的女子',
    '爷': '祖父',
    '奶': '祖母',
    '学': '学习，效法',
    '校': '学校，教育机构',
    '老': '年纪大的',
    '师': '老师，传授知识的人',
    '生': '出生，生长',
    '读': '看着文字念出声',
    '写': '用笔在纸上或其他东西上做字',
    '说': '用话来表达意思',
    '听': '用耳朵接受声音',
    '看': '使视线接触人或物',
    '问': '有不知道或不明白的事请人解答',
    '想': '动脑筋，思索',
    '做': '进行工作或活动',
    '玩': '游戏，玩耍',
    '笑': '露出愉快的表情，发出欢喜的声音',
    '哭': '因痛苦或悲哀而流泪发声',
    '吃': '把食物等放到嘴里经过咀嚼咽下去',
    '喝': '把液体或流食咽下去',
    '睡': '睡觉，休息',
    '走': '人或鸟兽的脚交互向前移动',
    '跑': '两只脚或四条腿迅速前进',
    '跳': '两脚用力离开地面向上或向前',
    '飞': '鸟、虫等在空中活动',
    '游': '人或动物在水里行动',
    '坐': '把臀部放在椅子等物体上支持身体',
    '站': '直着身体，两脚着地',
    '是': '表示判断、肯定',
    '不': '表示否定',
    '有': '表示存在',
    '无': '没有',
    '的': '用在定语后面，表示修饰关系',
    '在': '表示人或事物的位置',
    '和': '表示并列关系',
    '了': '表示动作已经完成',
    '着': '表示动作正在进行',
    '过': '表示动作曾经发生',
  };
  if (commonMeanings[hanzi]) return commonMeanings[hanzi];
  // 通用模板
  return `这个字读「${py || hanzi}」，是一个常用汉字。`;
}

/**
 * 用法说明模板（首版）：解释该字在句子中的常见用法。
 * 未来接入 AI 后用 AI 生成准确用法说明。
 * @param {string} hanzi
 * @param {string} sentence
 * @returns {string}
 */
function getUsage(hanzi, sentence) {
  if (!sentence) return '';
  const idx = sentence.indexOf(hanzi);
  if (idx < 0) return '';
  // 简化用法说明：指出字在句子中的位置和作用
  const before = sentence.slice(Math.max(0, idx - 3), idx);
  const after = sentence.slice(idx + 1, idx + 4);
  return `在句子「${sentence}」中，「${hanzi}」出现在「${before}...${after}」的位置，是句子的重要组成部分。`;
}

/**
 * 生成完整的教学内容。
 * @param {Object} char { hanzi, pinyin }
 * @param {Object} [context] { currentSentence } 当前学习的句子（用于用法说明）
 * @returns {Promise<Object>} { hanzi, pinyin, words, meaning, sentences, usage, speakParts }
 */
async function teach(char, context = {}) {
  const hanzi = char.hanzi;
  const pinyin = char.pinyin || '';
  const words = getWords(hanzi, 3);
  const sentences = getSentences(hanzi, 2);
  const exampleSentence = context.currentSentence || sentences[0] || '';

  let meaning = getMeaning(hanzi, pinyin);
  let usage = getUsage(hanzi, exampleSentence);

  // AI 接口：如果注入了 AI 教学生成器，用 AI 生成更准确的解释和用法
  if (aiTeacher) {
    try {
      const aiResult = await aiTeacher.generate(hanzi, { pinyin, words, sentences, currentSentence: exampleSentence });
      if (aiResult && aiResult.meaning) meaning = aiResult.meaning;
      if (aiResult && aiResult.usage) usage = aiResult.usage;
    } catch (e) {
      // AI 失败，用模板结果
    }
  }

  // 语音朗读的分段文本
  const speakParts = [
    `${hanzi}，读${pinyin || hanzi}。`,
    meaning,
    words.length > 0 ? `组词：${words.map(w => w.word).join('、')}。` : '',
    exampleSentence ? `例句：${exampleSentence}。` : '',
    usage,
  ].filter(Boolean);

  return {
    hanzi,
    pinyin,
    words,
    meaning,
    sentences,
    usage,
    exampleSentence,
    speakParts,
  };
}

/**
 * 注入 AI 教学内容生成器（预留）。
 * @param {{generate: Function}} teacher
 */
function setAITeacher(teacher) {
  if (teacher && typeof teacher.generate === 'function') {
    aiTeacher = teacher;
  }
}

module.exports = {
  init,
  teach,
  getWords,
  getSentences,
  getMeaning,
  getUsage,
  setAITeacher,
};
