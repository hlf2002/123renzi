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
let _xinhua = null;
let _dataDir = null;

// AI 教学内容生成器接口（预留）
// interface AITeacher { generate(hanzi, context): Promise<{meaning, usage}> }
let aiTeacher = null;

function init(dataDir) {
  _dataDir = dataDir;
}

function loadXinhua() {
  if (_xinhua) return _xinhua;
  if (!_dataDir) return {};
  try {
    _xinhua = JSON.parse(fs.readFileSync(path.join(_dataDir, 'xinhua.json'), 'utf8'));
  } catch (e) {
    _xinhua = {};
  }
  return _xinhua;
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
 * 只返回词语（word/phrase），不返回句子（sentence）。
 * 词库中找不到时，用内置常见词表兜底。
 * @param {string} hanzi
 * @param {number} count
 * @returns {Array<{word:string,type:string}>}
 */
function getWords(hanzi, count = 3) {
  const words = loadWords();
  const candidates = words
    .filter((w) => w.chars && w.chars.includes(hanzi))
    .filter((w) => w.type === 'word' || w.type === 'phrase') // 只返回词语，不返回句子
    .sort((a, b) => a.chars.length - b.chars.length); // 短词优先

  if (candidates.length > 0) {
    return candidates.slice(0, count).map((w) => ({ word: w.text, type: w.type }));
  }

  // 兜底：内置常见词表
  const fallback = FALLBACK_WORDS[hanzi] || [];
  return fallback.slice(0, count).map((w) => ({ word: w, type: 'word' }));
}

// 内置常见词表（词库中缺少的常见词，特别是包含生僻字的词）
const FALLBACK_WORDS = {
  '柠': ['柠檬'],
  '檬': ['柠檬'],
  '螃': ['螃蟹'],
  '蟹': ['螃蟹', '河蟹', '蟹黄'],
  '蝴': ['蝴蝶'],
  '蝶': ['蝴蝶', '蝶泳', '蝴蝶结'],
  '蜻': ['蜻蜓'],
  '蜓': ['蜻蜓'],
  '蚂': ['蚂蚁', '蚂蚱'],
  '蚁': ['蚂蚁', '白蚁', '蚁穴'],
  '葡': ['葡萄', '葡萄酒', '葡萄糖'],
  '萄': ['葡萄', '葡萄干'],
  '咖': ['咖啡', '咖喱'],
  '啡': ['咖啡'],
  '巧': ['巧克力', '巧妙', '巧合'],
  '克': ['巧克力', '克服', '千克'],
  '力': ['巧克力', '力量', '努力'],
  '沙': ['沙发', '沙子', '沙滩'],
  '发': ['沙发', '发现', '头发'],
  '吉': ['吉他', '吉祥', '吉利'],
  '他': ['吉他', '他们', '其他'],
};

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
 * 字义解释：优先使用新华字典，其次用内置高频字解释，最后用通用模板。
 * @param {string} hanzi
 * @param {string} pinyin
 * @returns {string}
 */
function getMeaning(hanzi, pinyin) {
  const xinhua = loadXinhua();

  // 1. 优先使用新华字典解释
  if (xinhua[hanzi] && xinhua[hanzi].meaning) {
    let meaning = xinhua[hanzi].meaning;

    // 处理字典用法说明：如"〔～蟹〕见蟹"。" → "螃蟹的螃，和蟹组成'螃蟹'"
    const usageMatch = meaning.match(/〔～(.+?)〕见(.+?)[”"]?[。.]?/);
    if (usageMatch) {
      const word = hanzi + usageMatch[1];
      meaning = `${word}的${hanzi}，和${usageMatch[1]}组成「${word}」`;
    }

    // 过滤包含英文解释的内容（如"[butterfly]。如蝶子..."）
    if (meaning.includes('[') && meaning.includes(']')) {
      const bracketMatch = meaning.match(/\[([^\]]+)\]/);
      if (bracketMatch) {
        // 提取英文对应的中文解释，或者用内置解释
        if (commonMeanings[hanzi]) {
          meaning = commonMeanings[hanzi];
        } else {
          meaning = meaning.replace(/\[[^\]]*\]/g, '').replace(/[。.]如.+/, '').trim();
        }
      }
    }

    // 过滤"蜻〈名〉的蜻"这种解释
    if (/[〈<][名动形数量代副介连助叹拟声][〉>]/.test(meaning) && meaning.length < 15) {
      if (commonMeanings[hanzi]) {
        meaning = commonMeanings[hanzi];
      } else {
        meaning = meaning.replace(/[〈<][名动形数量代副介连助叹拟声][〉>]/g, '').replace(/的[\u4e00-\u9fa5]$/, '').trim();
      }
    }

    // 检测是否为古义（不适合儿童的解释）
    const isOldMeaning = /(古|本义|古代|正梁|水名|山名|地名|姓氏|通假|假借|本指|原指|起身|腰带|束衣|刑法|法度|甲骨文|金文|小篆|部首|貌美)/.test(meaning)
      || meaning.length < 4
      || meaning.endsWith('的')
      || /^[a-z\s]+$/i.test(meaning) // 只有拼音没有解释
      || (meaning.includes(hanzi + ' ') && meaning.length < 10) // 只有字+拼音
      || /^[\u4e00-\u9fa5][a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s（）()]+$/i.test(meaning) // 只有字+拼音
      || /^[\u4e00-\u9fa5]{1,4}的[\u4e00-\u9fa5]$/.test(meaning); // "美,貌美的好"这种格式

    if (isOldMeaning && commonMeanings[hanzi]) {
      meaning = commonMeanings[hanzi];
    } else if (meaning.length < 6 && commonMeanings[hanzi]) {
      meaning = commonMeanings[hanzi];
    }

    // 最后兜底：如果解释为空、只有一个字、或是字典用法说明，用组词构造解释
    if (!meaning || meaning.length <= 1
      || /^见/.test(meaning) // "见［蜻蜓]"、"见柠檬"的檬"
      || /^如/.test(meaning) // "如葡萄"的萄"
      || /（[^\u4e00-\u9fa5]+）/.test(meaning) // 包含繁体字括号
      || /^[\u4e00-\u9fa5]（/.test(meaning) // "柠（檸）níng"
    ) {
      const words = getWords(hanzi, 1);
      if (words.length > 0) {
        const word = words[0].word;
        // 找到该字在词中的位置，构造解释
        const idx = word.indexOf(hanzi);
        if (idx >= 0 && word.length >= 2) {
          meaning = `${word}的${hanzi}，和其他字组成「${word}」`;
        } else {
          meaning = `这个字读「${hanzi}」，常见于「${word}」一词`;
        }
      } else {
        meaning = `这个字读「${hanzi}」，是一个常用汉字。`;
      }
    }

    return meaning;
  }

  // 2. 内置高频字解释
  if (commonMeanings[hanzi]) return commonMeanings[hanzi];

  // 3. 通用模板
  const py = pinyin || '';
  return `这个字读「${py || hanzi}」，是一个常用汉字。`;
}

// 内置高频字解释（100字），用于新华字典解释太短或不准确时补充
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
    // 补充常见字的现代常用义（新华字典本义是古义的字）
    '极': '顶点，尽头；非常',
    '洋': '海洋，广大；外国的',
    '作': '做，进行；作品',
    '给': '交付，送与；为，替',
    '带': '带领，携带；带子',
    '法': '方法，办法；法律',
    '傍': '靠近，临近',
    '坏': '品质恶劣，有害的；损坏',
    '眼': '眼睛，眼珠',
    '睛': '眼珠，眼睛',
    '宽': '宽阔，宽大；放宽',
    '找': '寻找，寻求',
    '变': '变化，改变',
    '海': '大海，海洋',
    '穆': '严肃，恭敬',
    '肃': '严肃，恭敬',
    '静': '安静，没有声音',
    '安': '安全，平安；安排',
  };

/**
 * 造句：四级降级策略（按适合儿童的程度排序）
 * 1. 优先从儿童句子库（sentences.json）提取
 * 2. 其次用组词模板造句（基于常用词生成简单句子）
 * 3. 最后从新华字典例句中提取（兜底，筛选简单的）
 * 4. 都没有则返回空
 * @param {string} hanzi
 * @param {number} count
 * @returns {Array<string>}
 */
function getSentences(hanzi, count = 2) {
  const sentences = loadSentences();
  const xinhua = loadXinhua();

  // 1. 优先从儿童句子库提取
  const kidSentences = sentences
    .filter((s) => s.text && s.text.includes(hanzi))
    .map((s) => s.text);

  if (kidSentences.length > 0) {
    return kidSentences.slice(0, count);
  }

  // 2. 用组词模板造句（比新华字典古文更适合儿童）
  const templateSentence = makeTemplateSentence(hanzi);
  if (templateSentence) {
    return [templateSentence];
  }

  // 3. 从新华字典例句中提取（兜底，严格筛选）
  if (xinhua[hanzi] && xinhua[hanzi].examples) {
    const simpleExamples = xinhua[hanzi].examples.filter((s) => {
      if (s.length > 20 || s.length < 5) return false;
      // 过滤古文
      if (/(矣|乎|焉|哉|也|兮|欤|亦|之乎者也)/.test(s)) return false;
      // 过滤包含拼音、数字、括号解释的行
      if (/[a-zāáǎàēéěèīíǐìōóǒòūúǔù]/.test(s)) return false;
      if (/\d/.test(s)) return false;
      if (s.includes('[') || s.includes(']') || s.includes('〔') || s.includes('〕')) return false;
      // 过滤不适合儿童的词
      if (/(霹雳|崩|歹徒|碴|刑法|酒浸|治风)/.test(s)) return false;
      return true;
    });
    if (simpleExamples.length > 0) {
      return simpleExamples.slice(0, count);
    }
  }

  return [];
}

/**
 * 用组词模板造句：基于常用词生成简单、适合儿童的句子。
 * @param {string} hanzi
 * @returns {string|null}
 */
function makeTemplateSentence(hanzi) {
  const words = getWords(hanzi, 3);
  if (words.length === 0) return null;

  // 取第一个常用词
  const word = words[0].word;
  const xinhua = loadXinhua();
  const pos = xinhua[hanzi] && xinhua[hanzi].pos ? xinhua[hanzi].pos[0] : '';

  // 动物/食物类名词模板
  const animalWords = ['螃蟹', '蝴蝶', '蜻蜓', '蚂蚁', '蜜蜂', '小鸟', '小鱼', '兔子', '老虎', '狮子', '大象', '猴子', '熊猫', '青蛙', '虫子', '鹦鹉', '鲸鱼', '海豚', '企鹅', '长颈鹿'];
  const foodWords = ['苹果', '香蕉', '西瓜', '葡萄', '草莓', '蛋糕', '饼干', '糖果', '米饭', '面条', '饺子', '包子', '牛奶', '果汁', '柠檬', '巧克力', '咖啡', '橙子', '桃子', '梨子'];

  if (animalWords.includes(word)) {
    return `${word}真可爱`;
  }
  if (foodWords.includes(word)) {
    return `我喜欢吃${word}`;
  }

  // 常见形容词列表（用"很XX"模板）
  const adjectiveWords = ['肃穆', '安静', '美丽', '漂亮', '高兴', '快乐', '开心', '难过', '伤心', '害怕', '勇敢', '聪明', '勤劳', '善良', '诚实', '认真', '仔细', '马虎', '骄傲', '谦虚', '热情', '冷淡', '温柔', '粗暴', '勤劳', '懒惰', '干净', '肮脏', '整齐', '混乱', '明亮', '黑暗', '温暖', '寒冷', '炎热', '凉爽', '潮湿', '干燥', '宽阔', '狭窄', '高大', '矮小', '肥胖', '瘦弱', '美丽', '丑陋', '善良', '凶恶', '聪明', '愚蠢', '勇敢', '胆小', '勤劳', '懒惰', '认真', '马虎', '仔细', '粗心', '谦虚', '骄傲', '诚实', '虚伪', '热情', '冷淡', '温柔', '粗暴'];

  if (adjectiveWords.includes(word) || pos === '形') {
    return `这里很${word}`;
  }

  // 常见动词列表（用"我喜欢XX"模板）
  const verbWords = ['学习', '读书', '写字', '画画', '唱歌', '跳舞', '跑步', '游泳', '踢球', '爬山', '旅行', '游戏', '玩耍', '睡觉', '吃饭', '喝水', '洗澡', '刷牙', '穿衣', '走路'];

  if (verbWords.includes(word) || pos === '动') {
    return `我喜欢${word}`;
  }

  // 常见名词（具体事物，可用"我看到了XX"）
  const concreteNouns = ['学校', '老师', '同学', '教室', '书本', '铅笔', '橡皮', '尺子', '书包', '桌子', '椅子', '窗户', '门', '房子', '汽车', '自行车', '飞机', '火车', '船', '树', '花', '草', '太阳', '月亮', '星星', '云', '雨', '雪', '风', '山', '水', '河', '海', '湖', '猫', '狗', '鸟', '鱼', '兔子', '老虎', '狮子', '大象', '猴子', '熊猫', '苹果', '香蕉', '西瓜', '葡萄', '草莓', '蛋糕', '饼干', '糖果', '米饭', '面条', '饺子', '包子', '牛奶', '果汁', '柠檬', '巧克力', '咖啡', '螃蟹', '蝴蝶', '蜻蜓', '蚂蚁', '蜜蜂', '鹦鹉', '企鹅', '长颈鹿', '海豚', '鲸鱼'];

  // 抽象名词（用"我知道XX"更合适）
  const abstractNouns = ['薪水', '年薪', '工资', '知识', '友谊', '爱情', '亲情', '时间', '金钱', '健康', '快乐', '幸福', '勇敢', '聪明', '勤劳', '善良', '诚实', '认真', '仔细', '谦虚', '骄傲', '热情', '温柔', '美丽', '漂亮', '高兴', '难过', '伤心', '害怕', '安静', '肃穆', '严肃', '平静', '冷静', '安全', '危险', '困难', '容易', '简单', '复杂', '重要', '必要', '可能', '应该', '可以', '能够', '需要', '想要', '希望', '梦想', '理想', '目标', '计划', '安排', '工作', '学习', '生活', '家庭', '社会', '国家', '世界', '历史', '文化', '艺术', '科学', '技术', '数学', '语文', '英语', '体育', '音乐', '美术', '游戏', '运动', '旅行', '假期', '周末', '节日', '生日', '礼物', '惊喜'];

  if (concreteNouns.includes(word)) {
    return `我看到了${word}`;
  }
  if (abstractNouns.includes(word)) {
    return `我知道${word}`;
  }

  // 名词默认用"我知道XX"（比"我看到了XX"更通用，避免抽象名词不自然）
  if (pos === '名') {
    return `我知道${word}`;
  }

  // 通用模板：用"我知道XX"比"XX真有意思"更通顺
  return `我知道${word}`;
}

/**
 * 句子解读：结合词性和造句，用儿童能理解的语言解释这个字在句子中的含义。
 * @param {string} hanzi
 * @param {string} sentence
 * @param {string} [pos] 词性
 * @param {string} [meaning] 字义
 * @returns {string}
 */
function getUsage(hanzi, sentence, pos, meaning) {
  const xinhua = loadXinhua();
  const wordPOS = pos || (xinhua[hanzi] && xinhua[hanzi].pos) || '';
  const wordMeaning = meaning || getMeaning(hanzi, '');

  // 词性的儿童友好解释
  const posExplain = {
    '名': '表示人、事物或地方的名字',
    '动': '表示一个动作或行为',
    '形': '形容事物的样子或性质',
    '数': '表示数量',
    '量': '表示事物的单位',
    '代': '代替人或事物的名称',
    '副': '修饰动作，表示程度、时间等',
    '介': '引出时间、地点、对象等',
    '连': '连接词语或句子',
    '助': '帮助句子表达语气',
    '叹': '表示感叹或应答',
    '拟声': '模拟声音',
  };

  let usage = '';

  // 先解释这个字在句子中的含义
  if (sentence && sentence.includes(hanzi)) {
    usage = `在「${sentence}」中，`;
    if (wordMeaning && wordMeaning.length < 30) {
      // 去掉字义中的「」，避免嵌套引号
      const cleanMeaning = wordMeaning.replace(/[「」]/g, '');
      usage += `「${hanzi}」的意思是「${cleanMeaning}」。`;
    } else {
      usage += `「${hanzi}」是一个${wordPOS[0] || '常用'}字。`;
    }
    // 再指出位置
    const idx = sentence.indexOf(hanzi);
    const before = sentence.slice(Math.max(0, idx - 2), idx);
    const after = sentence.slice(idx + 1, idx + 3);
    usage += `它用在「${before}...${after}」的位置。`;
  } else if (wordPOS) {
    // 没有造句时，只解释词性
    usage = `「${hanzi}」是${wordPOS[0]}词，${posExplain[wordPOS[0]] || ''}。`;
    if (wordMeaning && wordMeaning.length < 30) {
      usage += `意思是「${wordMeaning}」。`;
    }
  }

  return usage;
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

  // currentSentence 只有在是完整句子（长度>1且不等于单字）时才用作造句
  // 避免单字格学习时 currentSentence=单字，导致造句只有一个字
  let currentSentence = context.currentSentence || '';
  if (currentSentence.length <= 1 || currentSentence === hanzi) {
    currentSentence = '';
  }
  const exampleSentence = currentSentence || sentences[0] || '';

  const xinhua = loadXinhua();
  const pos = xinhua[hanzi] && xinhua[hanzi].pos ? xinhua[hanzi].pos : '';

  let meaning = getMeaning(hanzi, pinyin);
  let usage = getUsage(hanzi, exampleSentence, pos, meaning);

  // AI 接口：如果注入了 AI 教学生成器，用 AI 生成更准确的解释和用法
  if (aiTeacher) {
    try {
      const aiResult = await aiTeacher.generate(hanzi, { pinyin, words, sentences, currentSentence: exampleSentence, pos });
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
    pos,
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
