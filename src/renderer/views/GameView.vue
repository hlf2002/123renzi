<template>
  <div class="game">
    <!-- 顶部：返回 + 激励条 -->
    <header class="top">
      <button class="back" @click="goHome">‹</button>
      <div class="level-badge" v-if="level">
        <div class="lv-main">
          <span class="lv-grade">{{ level.grade }}</span>
          <span class="lv-pct">超过约 {{ level.percentile }}% 的同龄人</span>
        </div>
        <div class="lv-sub">已认识 {{ level.skill_level }} 个字 · 按同龄学习进度估算</div>
      </div>
      <div class="spacer"></div>
    </header>

    <div v-if="phase === 'loading'" class="center">继续学习中…</div>

    <!-- 主游戏区 -->
    <template v-else-if="phase === 'playing' || phase === 'learning'">
      <div class="stage" v-if="current">
        <p class="hint" v-if="phase === 'playing'">👇 <b>点一点你不认识的字，会的字不用点</b></p>
        <div class="sentence" v-if="phase === 'playing'" :class="carrierClass">
          <!-- 字格：可点选 -->
          <div
            v-for="(ch, i) in current.charsView"
            :key="i"
            class="char-cell"
            :class="{ marked: ch.marked }"
            @click="toggle(i)"
          >
            {{ ch.hanzi }}
            <span v-if="ch.marked" class="mark-tag">不认识</span>
          </div>
        </div>

        <div class="actions" v-if="phase === 'playing'">
          <button class="btn primary big" :disabled="submitting" @click="submit">
            {{ submitting ? '保存中…' : (hasMarked ? '确定' : '全都会') }}
          </button>
        </div>

        <!-- 学习卡阶段 -->
        <div v-else class="learn-area">
          <LearnCard :key="learnIndex" :char="learnQueue[learnIndex]" :current-sentence="currentSentence" :nickname="userNickname" />
          <div class="learn-next">
            <button class="btn primary big" @click="learnNext">
              {{ isWarehouseReview ? '完成' : (learnIndex < learnQueue.length - 1 ? '下一个' : '继续学') }}
            </button>
          </div>
        </div>
      </div>

      <!-- 底部：累计进度 + 仓库 -->
      <footer class="foot">
        <div class="progress-line">已认识 {{ level ? level.skill_level : 0 }} 个字，继续加油！</div>
        <WarehouseBar ref="warehouseBarRef" :counts="counts" :active="flyingWarehouse" @select="showWarehouseChars" />
      </footer>
    </template>

    <!-- 字卡飞入仓库动画层 -->
    <div v-if="isFlying" class="fly-layer">
      <!-- 单个字卡飞入 -->
      <div
        v-if="flyingChar"
        class="fly-char"
        :style="{
          left: flyingPos.x + 'px',
          top: flyingPos.y + 'px',
          transform: flyingPos.scale ? `scale(${flyingPos.scale})` : 'scale(1)',
          opacity: flyingPos.opacity,
        }"
      >{{ flyingChar }}</div>
      <!-- 多个字卡集体飞入 -->
      <div
        v-for="(item, i) in flyingChars"
        :key="i"
        class="fly-char"
        :style="{
          left: item.x + 'px',
          top: item.y + 'px',
          transform: `scale(${item.scale})`,
          opacity: item.opacity,
          transitionDelay: item.delay + 'ms',
        }"
      >{{ item.char }}</div>
    </div>

    <!-- 仓库字卡弹窗 -->
    <div v-if="showWarehouseModal" class="modal-mask" @click.self="closeWarehouseModal">
      <div class="modal-box">
        <div class="modal-header">
          <h3>{{ warehouseNames[selectedWarehouse] }}（{{ warehouseChars.length }}字）</h3>
          <button class="modal-close" @click="closeWarehouseModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="warehouseChars.length === 0" class="empty-tip">这个仓库还没有字哦～</div>
          <div v-else class="char-grid">
            <div v-for="(c, i) in warehouseChars" :key="i" class="char-card" @click="learnCharFromWarehouse(c)">
              <div class="cc-hanzi">{{ c.hanzi }}</div>
              <div class="cc-pinyin">{{ c.pinyin }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 真正学完（暂无新字/复习字）时的收尾页 -->
    <div v-else-if="phase === 'done'" class="done">
      <div class="done-emoji">🎉</div>
      <h2>今天的字都学完啦！</h2>
      <p class="done-sub">你已经认识 {{ level ? level.skill_level : 0 }} 个字。明天再来，会有新的字和复习等着你</p>
      <div class="done-stats" v-if="level">
        <div class="stat"><b>{{ level.grade }}</b><span>学习水平</span></div>
        <div class="stat"><b>约 {{ level.percentile }}%</b><span>超过的同龄人</span></div>
        <div class="stat"><b>{{ level.skill_level }}</b><span>已认识的字</span></div>
      </div>
      <WarehouseBar :counts="counts" class="done-bar" />
      <div class="done-actions">
        <button class="btn ghost" @click="goHome">回到主页</button>
      </div>
    </div>

    <div v-if="error" class="center err">{{ error }}</div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../store';
import WarehouseBar from '../components/WarehouseBar.vue';
import LearnCard from '../components/LearnCard.vue';

const route = useRoute();
const router = useRouter();
const userId = Number(route.params.userId);

const session = ref(null);
const queue = ref([]);
const qIndex = ref(0);
const phase = ref('loading');
const submitting = ref(false);
const level = ref(null);
const counts = ref({ 1: 0, 2: 0, 3: 0, 4: 0 });
const learnQueue = ref([]);
const userNickname = ref('小朋友');
const learnIndex = ref(0);

// 字卡飞入仓库动画
const warehouseBarRef = ref(null);
const isFlying = ref(false);
const flyingChar = ref('');
const flyingWarehouse = ref(0);
const flyingPos = ref({ x: 0, y: 0, scale: 1, opacity: 1 });
const flyingChars = ref([]); // 集体飞入的字
const knownCharsByWarehouse = ref({}); // 按仓库分组的认识的字 {1: [...], 2: [...], 3: [...], 4: [...]}

// 仓库字卡弹窗
const showWarehouseModal = ref(false);
const selectedWarehouse = ref(1);
const warehouseChars = ref([]);
const warehouseNames = { 1: '第一仓库', 2: '第二仓库', 3: '第三仓库', 4: '第四仓库' };
const isWarehouseReview = ref(false);
const error = ref('');

const current = computed(() => queue.value[qIndex.value] || null);
const currentSentence = computed(() => {
  if (!current.value || !current.value.item) return '';
  return current.value.item.text || '';
});
const carrierClass = computed(() => (session.value ? 'car-' + session.value.carrier : 'car-char'));
const kindTip = computed(() => {
  if (!current.value) return '';
  const t = current.value.item.type;
  if (t === 'char') return '这是一个字';
  if (t === 'word') return '这是一个词语';
  if (t === 'phrase') return '这是一句话';
  return '读一读这句话';
});

// 当前词/句中是否有被标记为“不认识”的字 → 决定按钮文案
const hasMarked = computed(() => {
  const cur = current.value;
  if (!cur || !cur.charsView) return false;
  return cur.charsView.some((c) => c.marked);
});

async function loadBatch() {
  phase.value = 'loading';
  error.value = '';
  try {
    // 并行获取用户昵称和会话，用户列表失败不影响主流程
    let users = [];
    try {
      users = await api.users.list();
    } catch (e) {
      console.warn('获取用户列表失败:', e.message);
    }
    const s = await api.session.get(userId);
    const user = users.find(u => u.user_id === userId);
    if (user && user.nickname) {
      userNickname.value = user.nickname;
    }
    level.value = s.level;
    counts.value = s.counts;
    // 既无新字也无复习字，才是真正的“今天学完了”（字库暂未导入更多 / 明日才有复习）
    if ((!s.newItems || s.newItems.length === 0) && (!s.reviewItems || s.reviewItems.length === 0)) {
      phase.value = 'done';
      return;
    }
    session.value = s;
    buildQueue();
    qIndex.value = 0;
    phase.value = 'playing';
  } catch (e) {
    error.value = '加载失败：' + (e && e.message ? e.message : e);
    phase.value = 'loading';
  }
}

function buildQueue() {
  const s = session.value;
  const q = [];
  const items = [...s.newItems, ...s.reviewItems];
  for (const it of items) {
    q.push({
      kind: 'item',
      item: it,
      charsView: it.chars.map((c) => ({ ...c, marked: false })),
    });
  }
  queue.value = q;
}

function toggle(i) {
  if (phase.value !== 'playing') return;
  const view = current.value.charsView[i];
  view.marked = !view.marked;
}

async function submit() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const cur = current.value;
    const results = cur.item.chars.map((c, i) => ({ charId: c.char_id, known: !cur.charsView[i].marked }));
    const res = await api.session.submit(userId, results);
    applyLevel(res);
    const toLearn = cur.item.chars.filter((c, i) => cur.charsView[i].marked);

    // 按目标仓库分组认识的字
    const byWarehouse = { 1: [], 2: [], 3: [], 4: [] };
    if (res && res.results) {
      for (const r of res.results) {
        if (r.to && byWarehouse[r.to]) {
          const char = cur.item.chars.find(c => c.char_id === r.charId);
          if (char) byWarehouse[r.to].push(char.hanzi);
        }
      }
    }
    knownCharsByWarehouse.value = byWarehouse;

    if (toLearn.length > 0) {
      learnQueue.value = toLearn;
      learnIndex.value = 0;
      phase.value = 'learning';
    } else {
      // 没有不认识的字，认识的字按仓库分组飞入
      playAllWarehouseFlyAnimation(byWarehouse, () => {
        next();
      });
    }
  } catch (e) {
    error.value = '保存失败：' + (e && e.message ? e.message : e);
  } finally {
    submitting.value = false;
  }
}

function applyLevel(res) {
  if (res && res.level) level.value = res.level;
  if (res && res.counts) counts.value = res.counts;
}

function next() {
  if (qIndex.value + 1 < queue.value.length) {
    qIndex.value += 1;
    phase.value = 'playing';
  } else {
    // 本批完成：自动加载下一批，游戏永不停
    loadBatch();
  }
}

function learnNext() {
  // 从仓库复习的字，学完后不播放飞入动画，直接完成
  if (isWarehouseReview.value) {
    doLearnNext();
    return;
  }
  // 播放字卡飞入仓库动画（学习完的字进W1）
  const char = learnQueue.value[learnIndex.value];
  const isLast = learnIndex.value >= learnQueue.value.length - 1;
  if (char) {
    playFlyAnimation(char.hanzi, 1, () => {
      if (isLast) {
        // 最后一个学习卡片完成后，认识的字按仓库分组飞入
        playAllWarehouseFlyAnimation(knownCharsByWarehouse.value, () => {
          doLearnNext();
        });
      } else {
        doLearnNext();
      }
    });
  } else {
    doLearnNext();
  }
}

function doLearnNext() {
  if (isWarehouseReview.value) {
    // 从仓库复习的字，学完后回到游戏界面
    isWarehouseReview.value = false;
    phase.value = 'playing';
    return;
  }
  if (learnIndex.value < learnQueue.value.length - 1) {
    learnIndex.value += 1;
  } else {
    next();
  }
}

/**
 * 播放字卡飞入仓库动画
 * @param {string} char - 字
 * @param {number} warehouse - 目标仓库（1-4）
 * @param {Function} callback - 动画结束回调
 */
function playFlyAnimation(char, warehouse, callback) {
  // 获取学习卡片中字的位置（屏幕中心偏上）
  const fromX = window.innerWidth / 2 - 40;
  const fromY = window.innerHeight / 2 - 100;

  // 获取目标仓库的位置
  let toX = fromX;
  let toY = window.innerHeight - 80;
  if (warehouseBarRef.value && warehouseBarRef.value.$el) {
    const wares = warehouseBarRef.value.$el.querySelectorAll('.ware');
    if (wares[warehouse - 1]) {
      const rect = wares[warehouse - 1].getBoundingClientRect();
      toX = rect.left + rect.width / 2 - 40;
      toY = rect.top + rect.height / 2 - 40;
    }
  }

  flyingChar.value = char;
  flyingWarehouse.value = warehouse;
  flyingPos.value = { x: fromX, y: fromY, scale: 1, opacity: 1 };
  isFlying.value = true;

  // 下一帧开始移动
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flyingPos.value = { x: toX, y: toY, scale: 0.3, opacity: 0 };
    });
  });

  // 动画结束后执行回调
  setTimeout(() => {
    isFlying.value = false;
    flyingWarehouse.value = 0;
    if (callback) callback();
  }, 700);
}

/**
 * 播放多个字卡集体飞入仓库动画
 * @param {Array<string>} chars - 字数组
 * @param {number} warehouse - 目标仓库（1-4）
 * @param {Function} callback - 动画结束回调
 */
function playGroupFlyAnimation(chars, warehouse, callback) {
  if (!chars || chars.length === 0) {
    if (callback) callback();
    return;
  }

  // 获取目标仓库的位置
  let toX = window.innerWidth / 2 - 40;
  let toY = window.innerHeight - 80;
  if (warehouseBarRef.value && warehouseBarRef.value.$el) {
    const wares = warehouseBarRef.value.$el.querySelectorAll('.ware');
    if (wares[warehouse - 1]) {
      const rect = wares[warehouse - 1].getBoundingClientRect();
      toX = rect.left + rect.width / 2 - 40;
      toY = rect.top + rect.height / 2 - 40;
    }
  }

  // 生成每个字的起始位置（屏幕中心区域，错落排列）
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2 - 50;
  const items = chars.map((char, i) => {
    // 错落排列，最多3列
    const col = i % 3;
    const row = Math.floor(i / 3);
    const offsetX = (col - 1) * 90;
    const offsetY = row * 90 - (Math.floor(chars.length / 3) * 45);
    return {
      char,
      x: centerX - 40 + offsetX,
      y: centerY - 40 + offsetY,
      scale: 1,
      opacity: 1,
      delay: i * 50, // 每个字延迟50ms出发
    };
  });

  flyingChars.value = items;
  flyingWarehouse.value = warehouse;
  isFlying.value = true;

  // 下一帧开始移动
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flyingChars.value = items.map(item => ({
        ...item,
        x: toX + (Math.random() - 0.5) * 30,
        y: toY + (Math.random() - 0.5) * 30,
        scale: 0.2,
        opacity: 0,
      }));
    });
  });

  // 动画结束后执行回调
  setTimeout(() => {
    isFlying.value = false;
    flyingWarehouse.value = 0;
    flyingChars.value = [];
    if (callback) callback();
  }, 900);
}

/**
 * 显示仓库中的字卡
 */
async function showWarehouseChars(warehouse) {
  selectedWarehouse.value = warehouse;
  warehouseChars.value = [];
  showWarehouseModal.value = true;
  try {
    const res = await api.progress.get(userId);
    if (res && res.rows) {
      warehouseChars.value = res.rows.filter(r => r.warehouse === warehouse);
    }
  } catch (e) {
    console.error('获取仓库字列表失败:', e.message);
  }
}

function closeWarehouseModal() {
  showWarehouseModal.value = false;
}

/**
 * 从仓库弹窗点击字卡，进入教学流程
 */
function learnCharFromWarehouse(char) {
  closeWarehouseModal();
  // 设置学习队列，进入学习阶段
  learnQueue.value = [{ char_id: char.char_id, hanzi: char.hanzi, pinyin: char.pinyin }];
  learnIndex.value = 0;
  phase.value = 'learning';
  // 记录这个字是从仓库复习的，学完后回到游戏界面
  isWarehouseReview.value = true;
}

/**
 * 播放多个仓库的字同时飞入动画
 * @param {Object} byWarehouse - 按仓库分组的字 {1: [...], 2: [...], 3: [...], 4: [...]}
 * @param {Function} callback - 动画结束回调
 */
function playAllWarehouseFlyAnimation(byWarehouse, callback) {
  // 收集所有需要飞入的字，带上目标仓库
  const allItems = [];
  for (let w = 1; w <= 4; w++) {
    const chars = byWarehouse[w] || [];
    for (const char of chars) {
      allItems.push({ char, warehouse: w });
    }
  }

  if (allItems.length === 0) {
    if (callback) callback();
    return;
  }

  // 获取每个仓库的目标位置
  const warehousePos = {};
  if (warehouseBarRef.value && warehouseBarRef.value.$el) {
    const wares = warehouseBarRef.value.$el.querySelectorAll('.ware');
    for (let w = 1; w <= 4; w++) {
      if (wares[w - 1]) {
        const rect = wares[w - 1].getBoundingClientRect();
        warehousePos[w] = {
          x: rect.left + rect.width / 2 - 40,
          y: rect.top + rect.height / 2 - 40,
        };
      }
    }
  }
  // 默认位置
  for (let w = 1; w <= 4; w++) {
    if (!warehousePos[w]) {
      warehousePos[w] = { x: window.innerWidth / 2 - 40, y: window.innerHeight - 80 };
    }
  }

  // 生成每个字的起始位置（屏幕中心区域，错落排列）
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2 - 50;
  const items = allItems.map((item, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const offsetX = (col - 1.5) * 80;
    const offsetY = row * 80 - (Math.floor(allItems.length / 4) * 40);
    const target = warehousePos[item.warehouse];
    return {
      char: item.char,
      warehouse: item.warehouse,
      x: centerX - 40 + offsetX,
      y: centerY - 40 + offsetY,
      toX: target.x + (Math.random() - 0.5) * 30,
      toY: target.y + (Math.random() - 0.5) * 30,
      scale: 1,
      opacity: 1,
      delay: i * 30,
    };
  });

  flyingChars.value = items;
  isFlying.value = true;

  // 下一帧开始移动
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flyingChars.value = items.map(item => ({
        ...item,
        x: item.toX,
        y: item.toY,
        scale: 0.2,
        opacity: 0,
      }));
    });
  });

  // 动画结束后执行回调
  setTimeout(() => {
    isFlying.value = false;
    flyingChars.value = [];
    if (callback) callback();
  }, 900);
}

watch(phase, (v) => {
  if (v === 'playing') error.value = '';
});

function goHome() {
  router.push('/login');
}

onMounted(loadBatch);
</script>

<style scoped>
.game {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #fff7ea 0%, #fffdf6 100%);
  overflow: hidden;
}
.top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 22px 8px 130px;
}
.back {
  width: 44px; height: 44px;
  border: none;
  border-radius: 50%;
  background: #ffe9c7;
  color: #8a6d3b;
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
}
.spacer { flex: 1; }
.level-badge {
  background: #fff;
  border: 3px solid #ffd9a0;
  border-radius: 18px;
  padding: 8px 22px;
  text-align: center;
}
.lv-main { display: flex; align-items: baseline; gap: 12px; }
.lv-grade { font-size: 22px; font-weight: 900; color: #d94f2b; }
.lv-pct { font-size: 15px; font-weight: 700; color: #4bb3ff; }
.lv-sub { font-size: 12px; color: #b59a72; margin-top: 2px; }

.center { flex: 1; display: flex; align-items: center; justify-content: center; color: #8a6d3b; font-size: 18px; }
.center.err { color: #d94f2b; }

.stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 24px; gap: 22px; }
.kind-tip { color: #c58f3f; font-size: 15px; font-weight: 600; }
.sentence {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  max-width: 860px;
  background: #fff;
  border-radius: 26px;
  padding: 30px 28px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.sentence.single { padding: 26px; }
.char-cell {
  position: relative;
  width: 86px; height: 86px;
  border: 3px solid #f0d9b0;
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 48px;
  font-weight: 800;
  color: #5a4630;
  background: #fffdf6;
  cursor: pointer;
  transition: all 0.12s;
}
.char-cell:hover { border-color: #52c41a; background: #f6ffed; transform: scale(1.12); box-shadow: 0 4px 12px rgba(82, 196, 26, 0.3); }
.char-cell.marked {
  border-color: #d94f2b;
  background: #ffe3d6;
  color: #d94f2b;
  /* 不划掉字，只改变背景色标记 */
}
.mark-tag {
  position: absolute;
  bottom: -22px; left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  background: #d94f2b;
  color: #fff;
  border-radius: 8px;
  padding: 1px 8px;
  white-space: nowrap;
}
.car-char .char-cell { width: 110px; height: 110px; font-size: 64px; }
.car-word .char-cell { width: 96px; height: 96px; font-size: 54px; }
.car-phrase .char-cell { width: 80px; height: 80px; font-size: 44px; }
.car-sentence .char-cell { width: 74px; height: 74px; font-size: 40px; }

.hint { color: #b59a72; font-size: 15px; margin: 0; }
.actions { display: flex; justify-content: center; }

.btn { border: none; border-radius: 18px; padding: 12px 26px; font-size: 17px; font-weight: 800; }
.btn.primary { background: #ffb347; color: #fff; }
.btn.primary:disabled { opacity: 0.6; cursor: default; }
.btn.big { padding: 14px 38px; font-size: 19px; }
.btn.ghost { background: #f0ece4; color: #8a6d3b; }

.learn-area { width: 100%; max-width: 420px; }
.learn-next { display: flex; justify-content: center; margin-top: 12px; }

.foot { padding: 8px 26px 18px; }
.progress-line { text-align: center; color: #b59a72; font-size: 13px; margin-bottom: 8px; }

.done { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; text-align: center; }
.done-emoji { font-size: 72px; }
.done h2 { color: #d94f2b; font-size: 34px; margin: 0; }
.done-sub { color: #8a6d3b; margin: 0; }
.done-stats { display: flex; gap: 14px; margin: 10px 0; }
.stat {
  background: #fff;
  border: 3px solid #ffe0ae;
  border-radius: 18px;
  padding: 12px 20px;
  min-width: 110px;
}
.stat b { display: block; font-size: 22px; color: #d94f2b; }
.stat span { font-size: 13px; color: #8a6d3b; }
.done-bar { max-width: 620px; margin: 6px 0 14px; }
.done-actions { display: flex; gap: 14px; }

/* 字卡飞入仓库动画 */
.fly-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
}
.fly-char {
  position: absolute;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 800;
  color: #d94f2b;
  background: #fff;
  border: 4px solid #ffd9a0;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.fly-char.small {
  width: 60px;
  height: 60px;
  font-size: 36px;
}

/* 仓库字卡弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.modal-box {
  background: #fff;
  border-radius: 20px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 2px solid #ffe0ae;
  background: #fff7ea;
}
.modal-header h3 {
  margin: 0;
  color: #d94f2b;
  font-size: 18px;
}
.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: #ffe9c7;
  color: #8a6d3b;
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
}
.modal-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}
.empty-tip {
  text-align: center;
  color: #b59a72;
  padding: 40px 0;
  font-size: 15px;
}
.char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 10px;
}
.char-card {
  background: #fff;
  border: 2px solid #ffe0ae;
  border-radius: 12px;
  padding: 8px 4px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.char-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  border-color: #ffc97a;
}
.cc-hanzi {
  font-size: 28px;
  font-weight: 700;
  color: #5a4630;
}
.cc-pinyin {
  font-size: 11px;
  color: #b59a72;
  margin-top: 2px;
}
</style>
