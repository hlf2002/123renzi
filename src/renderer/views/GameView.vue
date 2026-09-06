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
        <div class="kind-tip" v-if="phase === 'playing'">{{ kindTip }}</div>
        <div class="sentence" v-if="phase === 'playing'" :class="current.kind === 'probe' ? 'single' : carrierClass">
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

        <p class="hint" v-if="phase === 'playing'">👇 点一点你不认识的字，会的字不用点</p>

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
              {{ learnIndex < learnQueue.length - 1 ? '下一个' : '继续学' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 底部：累计进度 + 仓库 -->
      <footer class="foot">
        <div class="progress-line">已认识 {{ level ? level.skill_level : 0 }} 个字，继续加油！</div>
        <WarehouseBar ref="warehouseBarRef" :counts="counts" :active="flyingWarehouse" />
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
const knownChars = ref([]); // 当前批次中认识的字
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
    // 记录认识的字（没有被标记为不认识的字）
    knownChars.value = cur.item.chars.filter((c, i) => !cur.charsView[i].marked).map(c => c.hanzi);
    if (toLearn.length > 0) {
      learnQueue.value = toLearn;
      learnIndex.value = 0;
      phase.value = 'learning';
      // LearnCard会自动朗读完整讲解，不需要单独读字
    } else {
      // 没有不认识的字，认识的字集体飞入W4
      if (knownChars.value.length > 0) {
        playGroupFlyAnimation(knownChars.value, 4, () => {
          next();
        });
      } else {
        next();
      }
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
  // 播放字卡飞入仓库动画（学习完的字进W1）
  const char = learnQueue.value[learnIndex.value];
  const isLast = learnIndex.value >= learnQueue.value.length - 1;
  if (char) {
    playFlyAnimation(char.hanzi, 1, () => {
      if (isLast) {
        // 最后一个学习卡片完成后，认识的字集体飞入W4
        if (knownChars.value.length > 0) {
          playGroupFlyAnimation(knownChars.value, 4, () => {
            doLearnNext();
          });
        } else {
          doLearnNext();
        }
      } else {
        doLearnNext();
      }
    });
  } else {
    doLearnNext();
  }
}

function doLearnNext() {
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
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #fff7ea 0%, #fffdf6 100%);
}
.top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px 8px;
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
.char-cell:hover { border-color: #ffb347; transform: scale(1.04); }
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
</style>
