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
        <div class="kind-tip">{{ kindTip }}</div>
        <div class="sentence" :class="current.kind === 'probe' ? 'single' : carrierClass">
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
          <LearnCard :key="learnIndex" :char="learnQueue[learnIndex]" :current-sentence="currentSentence" />
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
        <WarehouseBar :counts="counts" />
      </footer>
    </template>

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
import { api, speak } from '../store';
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
const learnIndex = ref(0);
const error = ref('');

const current = computed(() => queue.value[qIndex.value] || null);
const currentSentence = computed(() => {
  if (!current.value || !current.value.item) return '';
  return current.value.item.text || '';
});
const carrierClass = computed(() => (session.value ? 'car-' + session.value.carrier : 'car-char'));
const kindTip = computed(() => {
  if (!current.value) return '';
  if (current.value.kind === 'probe') return '考考你～这个字认识吗？';
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
    const s = await api.session.get(userId);
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
  let inserted = 0;
  for (const it of items) {
    q.push({
      kind: 'item',
      item: it,
      charsView: it.chars.map((c) => ({ ...c, marked: false })),
    });
    inserted++;
    if (inserted % 5 === 0 && s.probe) {
      q.push({
        kind: 'probe',
        probe: s.probe,
        charsView: [{ char_id: 'probe', hanzi: s.probe.hanzi, pinyin: s.probe.pinyin, marked: false }],
      });
    }
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
    if (cur.kind === 'item') {
      const results = cur.item.chars.map((c, i) => ({ charId: c.char_id, known: !cur.charsView[i].marked }));
      const res = await api.session.submit(userId, results);
      applyLevel(res);
      const toLearn = cur.item.chars.filter((c, i) => cur.charsView[i].marked);
      if (toLearn.length > 0) {
        learnQueue.value = toLearn;
        learnIndex.value = 0;
        phase.value = 'learning';
        speakSoon(toLearn[0].hanzi);
      } else {
        next();
      }
    } else {
      const known = !cur.charsView[0].marked;
      const res = await api.session.submitProbe(userId, known);
      applyLevel(res);
      next();
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
  if (learnIndex.value < learnQueue.value.length - 1) {
    learnIndex.value += 1;
    speakSoon(learnQueue.value[learnIndex.value].hanzi);
  } else {
    next();
  }
}

function speakSoon(text) {
  setTimeout(() => speak(text), 350);
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
  text-decoration: line-through;
  text-decoration-thickness: 3px;
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
.learn-next { display: flex; justify-content: center; margin-top: 18px; }

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
</style>
