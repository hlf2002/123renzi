'use strict';
/**
 * 生成一年级字库包示例数据（chars.json + words.json）。
 * 注意：此字表为「贴近部编版一年级常用字」的示例数据，用于首版跑通玩法；
 * 真实教材生字表需后续按教材核对后整体导入（策划案 8.3 分批导入策略）。
 */
const fs = require('fs');
const path = require('path');

// 一年级常用字（示例，study_order 按数组顺序 1..N）
const CHARS = [
  ['天', 'tian'], ['地', 'di'], ['人', 'ren'], ['你', 'ni'], ['我', 'wo'], ['他', 'ta'],
  ['一', 'yi'], ['二', 'er'], ['三', 'san'], ['四', 'si'], ['五', 'wu'],
  ['上', 'shang'], ['下', 'xia'], ['口', 'kou'], ['耳', 'er'], ['目', 'mu'], ['手', 'shou'], ['足', 'zu'],
  ['站', 'zhan'], ['坐', 'zuo'], ['日', 'ri'], ['月', 'yue'], ['水', 'shui'], ['火', 'huo'],
  ['山', 'shan'], ['石', 'shi'], ['田', 'tian'], ['禾', 'he'],
  ['对', 'dui'], ['云', 'yun'], ['雨', 'yu'], ['风', 'feng'], ['花', 'hua'], ['鸟', 'niao'], ['虫', 'chong'],
  ['六', 'liu'], ['七', 'qi'], ['八', 'ba'], ['九', 'jiu'], ['十', 'shi'],
  ['爸', 'ba'], ['妈', 'ma'], ['马', 'ma'],
  ['土', 'tu'], ['不', 'bu'],
  ['画', 'hua'], ['打', 'da'], ['棋', 'qi'], ['鸡', 'ji'],
  ['字', 'zi'], ['词', 'ci'], ['语', 'yu'], ['文', 'wen'],
  ['数', 'shu'], ['学', 'xue'], ['音', 'yin'], ['乐', 'yue'],
  ['妹', 'mei'], ['奶', 'nai'], ['白', 'bai'], ['皮', 'pi'],
  ['小', 'xiao'], ['桥', 'qiao'], ['台', 'tai'], ['雪', 'xue'],
  ['儿', 'er'], ['是', 'shi'], ['灯', 'deng'], ['走', 'zou'], ['也', 'ye'],
  ['球', 'qiu'], ['拔', 'ba'], ['拍', 'pai'],
  ['跳', 'tiao'], ['跑', 'pao'], ['步', 'bu'],
  ['声', 'sheng'], ['身', 'shen'], ['色', 'se'],
  ['金', 'jin'], ['木', 'mu'], ['竹', 'zhu'],
  ['会', 'hui'], ['独', 'du'], ['立', 'li'],
  ['们', 'men'], ['个', 'ge'], ['头', 'tou'], ['里', 'li'],
  ['来', 'lai'], ['去', 'qu'],
  ['送', 'song'], ['门', 'men'], ['关', 'guan'], ['进', 'jin'], ['出', 'chu'],
  ['果', 'guo'], ['弯', 'wan'],
  ['北', 'bei'], ['京', 'jing'], ['安', 'an'], ['生', 'sheng'],
  ['玩', 'wan'], ['现', 'xian'], ['在', 'zai'], ['有', 'you'], ['用', 'yong'],
  ['变', 'bian'], ['只', 'zhi'],
  ['歌', 'ge'], ['唱', 'chang'],
  ['波', 'bo'], ['浪', 'lang'],
  ['大', 'da'], ['气', 'qi'], ['朵', 'duo'], ['说', 'shuo'], ['话', 'hua'], ['爱', 'ai'], ['苗', 'miao'], ['了', 'le'],
];

// 词句库：只用字表内的字（脚本会校验）
const POOL = [
  { text: '妈妈', type: 'word' },
  { text: '爸爸', type: 'word' },
  { text: '小鸟', type: 'word' },
  { text: '山水', type: 'word' },
  { text: '火山', type: 'word' },
  { text: '白云', type: 'word' },
  { text: '天气', type: 'word' },
  { text: '大地', type: 'word' },
  { text: '我们', type: 'word' },
  { text: '你们', type: 'word' },
  { text: '他们', type: 'word' },
  { text: '花朵', type: 'word' },
  { text: '石头', type: 'word' },
  { text: '小桥', type: 'word' },
  { text: '门口', type: 'word' },
  { text: '上来', type: 'word' },
  { text: '下去', type: 'word' },
  { text: '日月', type: 'word' },
  { text: '耳朵', type: 'word' },
  { text: '小手', type: 'word' },
  { text: '唱歌', type: 'word' },
  { text: '北京', type: 'word' },
  { text: '生日', type: 'word' },
  { text: '水花', type: 'word' },
  { text: '大门', type: 'word' },
  { text: '小人', type: 'word' },
  { text: '山上', type: 'word' },
  { text: '火苗', type: 'word' },
  { text: '学说话', type: 'phrase' },
  { text: '大山上', type: 'phrase' },
  { text: '白云上', type: 'phrase' },
  { text: '山上有花', type: 'phrase' },
  { text: '我们上学', type: 'phrase' },
  { text: '天上有云', type: 'phrase' },
  { text: '门关了', type: 'phrase' },
  { text: '我来了', type: 'phrase' },
  { text: '小鸟在唱歌', type: 'phrase' },
  { text: '一二三', type: 'phrase' },
  { text: '我爱妈妈', type: 'sentence' },
  { text: '妈妈爱我', type: 'sentence' },
  { text: '我们上学去', type: 'sentence' },
  { text: '小鸟在唱歌', type: 'sentence' },
  { text: '天上有白云', type: 'sentence' },
  { text: '门关了', type: 'sentence' },
  { text: '山上有花', type: 'sentence' },
  { text: '北京有大学', type: 'sentence' },
  { text: '我走上来', type: 'sentence' },
  { text: '我们去山上', type: 'sentence' },
];

function main() {
  // 去重（按字）
  const seen = new Set();
  const chars = [];
  for (const [hanzi, pinyin] of CHARS) {
    if (seen.has(hanzi)) continue;
    seen.add(hanzi);
    chars.push({
      hanzi,
      pinyin,
      stroke_count: 0, // 笔画数为占位，真实数据后续随教材导入
      study_order: chars.length + 1,
      grade_level: 'g1',
      source: 'demo',
      content_pack: 'grade1',
    });
  }

  // 校验词句：所有字必须在字表内
  const hanziSet = new Set(chars.map((c) => c.hanzi));
  const missing = new Set();
  for (const e of POOL) {
    for (const h of Array.from(e.text)) {
      if (!hanziSet.has(h)) missing.add(h);
    }
  }
  if (missing.size > 0) {
    console.error('词句含未收录字：', [...missing].join(''));
    process.exit(1);
  }

  const outDir = path.join(__dirname, '..', 'src', 'assets', 'content', 'grade1');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'chars.json'), JSON.stringify(chars, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'words.json'), JSON.stringify(POOL, null, 2), 'utf8');
  console.log(`已生成：${chars.length} 个字，${POOL.length} 条词句 → ${outDir}`);
}

main();
