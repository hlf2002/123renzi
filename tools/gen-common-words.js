'use strict';
/**
 * 从《现代汉语常用词表》(第2版) 过滤儿童常用词 + 补充儿童常用短句。
 */
const fs = require('fs');
const path = require('path');

const TSV_PATH = '/tmp/common-words.tsv';
const CHARS_PATH = path.join(__dirname, '..', 'src', 'assets', 'content', 'full', 'chars.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'assets', 'content', 'full', 'words.json');

const chars = JSON.parse(fs.readFileSync(CHARS_PATH, 'utf8'));
const charSet = new Set(chars.map((c) => c.hanzi));

// 不适合儿童的词（包含这些字的词过滤掉）
const BAD_KEYWORDS = ['党', '共产', '社会主义', '马克思', '邓小平', '毛泽东', '政治', '革命',
  '阶级', '帝国', '资本', '封建', '殖民', '侵略', '战争', '军队', '武器',
  '犯罪', '法律', '法院', '检察', '司法', '监狱', '警察', '逮捕', '审判',
  '死亡', '病', '癌', '疫', '毒', '赌', '嫖', '淫', '色', '裸',
  '贸易', '经济', '金融', '银行', '股票', '证券', '保险', '税收', '财政',
  '国际', '外交', '联合国', '北约', '欧盟', '总统', '总理', '主席', '部长',
  '主义', '思想', '理论', '代表', '大会', '会议', '决议', '政策', '制度'];

function containsBad(word) {
  return BAD_KEYWORDS.some((k) => word.includes(k));
}

// 儿童常用短句（5-8字，全部由常用字组成，适合儿童理解）
const KID_SENTENCES = [
  '我是小学生', '你是好孩子', '他是我朋友', '我们一起玩', '你们去哪里',
  '他们在看书', '今天天气好', '明天去上学', '小鸟在天上飞', '小鱼在水里游',
  '小猫在睡觉', '小狗在跑步', '我喜欢吃苹果', '你喜欢吃香蕉', '他喜欢吃西瓜',
  '妈妈去上班', '爸爸在做饭', '爷爷在浇花', '奶奶在看电视', '哥哥在写作业',
  '姐姐在画画', '弟弟在玩玩具', '妹妹在唱歌', '山上有大树', '河里有小鱼',
  '天上有白云', '地上有红花', '教室里有同学', '操场上有老师', '图书馆里有书',
  '公园里有花', '动物园里有动物', '我今天很高兴', '你今天开心吗', '他今天很难过',
  '我们要好好学习', '你们要认真听讲', '他们要努力工作', '太阳从东边升起',
  '月亮在晚上出来', '星星在天上眨眼', '春天来了花开了', '夏天到了天气热',
  '秋天来了树叶黄', '冬天到了下雪了', '一年有四个季节', '一天有二十四小时',
  '我会自己穿衣服', '你会自己吃饭吗', '他会自己洗衣服', '我们要爱护小动物',
  '你们要保护环境', '他们要节约用水', '红灯停绿灯行', '过马路要走斑马线',
  '上下楼梯靠右走', '在学校要听老师话', '在家里要听爸妈话', '吃饭前要洗手',
  '睡觉前要刷牙', '早上起来要洗脸', '我有一个好朋友', '你有几本书',
  '他有一支新铅笔', '我们班有三十人', '你们学校有多大', '他们家有几口人',
  '这是我的书包', '那是你的铅笔', '这里有很多花', '那里有很多树',
  '今天是星期一', '明天是星期二', '昨天是星期日', '我最喜欢春天', '你最喜欢夏天',
  '他最喜欢秋天', '我们都喜欢冬天', '小猫喜欢吃鱼', '小狗喜欢吃肉',
  '小鸟喜欢吃虫子', '小鱼喜欢吃水草', '我不喜欢吃青菜', '你不喜欢吃辣椒',
  '我们要做个好孩子', '你们要做个好学生', '他们要做个好公民',
];

// 读取词表
const lines = fs.readFileSync(TSV_PATH, 'utf8').split('\n');
const words = [];
const seen = new Set();

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t');
  if (cols.length < 5) continue;
  const freq = parseInt(cols[0], 10);
  const word = cols[1];
  const special = cols[3];
  const len = parseInt(cols[4], 10);
  if (!word || freq > 25000) break;
  if (special && special.trim()) continue;
  if (len < 2 || len > 6) continue;
  if (containsBad(word)) continue;
  const hanziList = Array.from(word).filter((c) => /\p{Script=Han}/u.test(c));
  if (hanziList.length !== len) continue;
  if (!hanziList.every((c) => charSet.has(c))) continue;
  if (seen.has(word)) continue;
  seen.add(word);
  let type;
  if (len === 2) type = 'word';
  else if (len <= 4) type = 'phrase';
  else type = 'sentence';
  words.push({ content_id: words.length + 1, text: word, type, chars: hanziList });
}

// 补充儿童常用短句
for (const s of KID_SENTENCES) {
  if (seen.has(s)) continue;
  const hanziList = Array.from(s).filter((c) => /\p{Script=Han}/u.test(c));
  if (!hanziList.every((c) => charSet.has(c))) continue;
  seen.add(s);
  words.push({ content_id: words.length + 1, text: s, type: 'sentence', chars: hanziList });
}

// 重新编号
words.forEach((w, i) => { w.content_id = i + 1; });

const byType = { word: 0, phrase: 0, sentence: 0 };
for (const w of words) byType[w.type]++;
console.log('总词数:', words.length);
console.log('按类型:', JSON.stringify(byType));
console.log('双字词样例:', words.filter((w) => w.type === 'word').slice(0, 12).map((w) => w.text).join(' '));
console.log('短语样例:', words.filter((w) => w.type === 'phrase').slice(0, 12).map((w) => w.text).join(' '));
console.log('短句样例:', words.filter((w) => w.type === 'sentence').slice(-15).map((w) => w.text).join(' | '));

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(words, null, 2), 'utf8');
console.log('已写入:', OUTPUT_PATH);
