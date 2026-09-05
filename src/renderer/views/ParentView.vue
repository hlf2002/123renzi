<template>
  <div class="parent">
    <header class="p-top">
      <button class="back" @click="$router.push('/login')">‹</button>
      <h2>家长面板</h2>
      <select v-model="curUserId" class="user-sel" @change="loadUser">
        <option v-for="u in users" :key="u.user_id" :value="u.user_id">{{ u.nickname }}</option>
      </select>
    </header>

    <div class="p-body">
      <!-- 复习间隔设置 -->
      <section class="card">
        <h3>复习间隔（天）</h3>
        <p class="tip">数字越大复习越少；改完点保存，之后新安排的复习按此执行</p>
        <div class="delay-grid">
          <label v-for="w in [1, 2, 3, 4]" :key="w">
            <span>仓库{{ w }}</span>
            <input v-model.number="delays[w]" type="number" min="0" max="365" />
            <em>天</em>
          </label>
        </div>
        <button class="btn primary" @click="saveDelays">保存间隔</button>
        <span v-if="savedTip" class="saved-tip">{{ savedTip }}</span>
      </section>

      <!-- 当前孩子评估 -->
      <section class="card" v-if="level">
        <h3>学习水平（持续评估）</h3>
        <div class="lv-grid">
          <div class="kv"><b>{{ level.grade }}</b><span>年级水平</span></div>
          <div class="kv"><b>约 {{ level.percentile }}%</b><span>超过同龄人（估算）</span></div>
          <div class="kv"><b>{{ level.skill_level }}</b><span>已认识字</span></div>
          <div class="kv"><b>{{ Math.round((level.recent_accuracy || 0) * 100) }}%</b><span>近期正确率</span></div>
          <div class="kv"><b>第 {{ (level.band || 0) + 1 }} 段</b><span>难度区间</span></div>
          <div class="kv"><b>{{ level.assessed_chars || 0 }}</b><span>已评估字次</span></div>
        </div>
        <p class="tip">当前识别规则：连续 5 次全对自动跳到更难的字；连续 3 次答错自动降回来。</p>
      </section>

      <!-- 进度表 -->
      <section class="card">
        <h3>字库进度（{{ progress.rows ? progress.rows.length : 0 }} 个已见面字）</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>字</th><th>拼音</th><th>仓库</th><th>下次复习</th><th>复习次数</th></tr></thead>
            <tbody>
              <tr v-for="r in progress.rows" :key="r.char_id">
                <td class="hz">{{ r.hanzi }}</td>
                <td>{{ r.pinyin }}</td>
                <td><span class="w-badge" :style="{ background: wColor(r.warehouse) }">W{{ r.warehouse }}</span></td>
                <td>{{ fmtDate(r.next_review_at) }}</td>
                <td>{{ r.review_count }}</td>
              </tr>
              <tr v-if="!progress.rows || progress.rows.length === 0"><td colspan="5" class="empty">还没有学过的字</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 学习日志 -->
      <section class="card" v-if="logs.length">
        <h3>最近学习记录</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>时间</th><th>变化</th><th>结果</th></tr></thead>
            <tbody>
              <tr v-for="(l, i) in logs.slice().reverse().slice(0, 60)" :key="i">
                <td>{{ fmtDate(l.ts) }}</td>
                <td>W{{ l.from }} → W{{ l.to }}</td>
                <td>{{ l.result ? '认识 ✓' : '不认识 ✗' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { api, WAREHOUSE_COLORS } from '../store';

const users = ref([]);
const curUserId = ref(null);
const settings = ref(null);
const delays = ref({ 1: 1, 2: 3, 3: 7, 4: 30 });
const savedTip = ref('');
const level = ref(null);
const progress = ref({ rows: [] });
const logs = ref([]);

async function loadUsers() {
  users.value = await api.users.list();
  if (users.value.length) {
    curUserId.value = users.value[0].user_id;
    await loadUser();
  }
}
async function loadSettings() {
  settings.value = await api.settings.get();
  if (settings.value && settings.value.delays) delays.value = { ...settings.value.delays };
}
async function loadUser() {
  if (!curUserId.value) return;
  [level.value, progress.value, logs.value] = await Promise.all([
    api.level.get(curUserId.value),
    api.progress.get(curUserId.value),
    api.logs.get(curUserId.value),
  ]);
}
async function saveDelays() {
  const d = { ...delays.value };
  for (const k of [1, 2, 3, 4]) d[k] = Math.max(0, Math.round(Number(d[k]) || 0));
  await api.settings.set({ delays: d });
  savedTip.value = '已保存 ✓';
  setTimeout(() => (savedTip.value = ''), 2000);
}
function fmtDate(s) {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d)) return s;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function wColor(w) {
  return WAREHOUSE_COLORS[w] || '#ccc';
}

onMounted(async () => {
  await loadSettings();
  await loadUsers();
});
</script>

<style scoped>
.parent { min-height: 100%; background: #f7f3ec; }
.p-top {
  display: flex; align-items: center; gap: 14px;
  padding: 18px 24px;
  background: #fff;
  border-bottom: 1px solid #eee;
  position: sticky; top: 0; z-index: 2;
}
.p-top h2 { margin: 0; color: #5a4630; font-size: 20px; }
.back {
  width: 42px; height: 42px; border: none; border-radius: 50%;
  background: #efe2cd; color: #8a6d3b; font-size: 24px; font-weight: 700; line-height: 1;
}
.user-sel {
  margin-left: auto;
  padding: 8px 12px;
  border: 2px solid #e0cfa8;
  border-radius: 12px;
  background: #fffdf6;
  font-size: 15px;
  color: #5a4630;
}
.p-body { padding: 20px 24px 60px; max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
.card {
  background: #fff;
  border-radius: 20px;
  padding: 18px 22px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}
.card h3 { margin: 0 0 10px; color: #5a4630; font-size: 17px; }
.tip { color: #a08a66; font-size: 13px; margin: 0 0 12px; }
.delay-grid { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
.delay-grid label {
  display: flex; align-items: center; gap: 8px;
  border: 2px solid #f0d9b0; border-radius: 12px; padding: 8px 12px;
}
.delay-grid input { width: 70px; padding: 6px; border: 1px solid #ddd; border-radius: 8px; text-align: center; font-size: 16px; }
.delay-grid em { font-style: normal; color: #a08a66; }
.btn { border: none; border-radius: 14px; padding: 10px 22px; font-size: 15px; font-weight: 700; }
.btn.primary { background: #ffb347; color: #fff; }
.saved-tip { margin-left: 12px; color: #4bb3ff; font-weight: 700; }
.lv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
.kv {
  border: 2px solid #f0e0c0; border-radius: 14px; padding: 10px 14px; text-align: center;
}
.kv b { display: block; font-size: 20px; color: #d94f2b; }
.kv span { font-size: 12px; color: #8a6d3b; }
.table-wrap { max-height: 380px; overflow: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 8px 10px; border-bottom: 1px solid #f2ead9; text-align: left; }
th { color: #a08a66; font-weight: 600; position: sticky; top: 0; background: #fff; }
.hz { font-size: 20px; font-weight: 800; color: #5a4630; }
.w-badge { display: inline-block; padding: 2px 10px; border-radius: 10px; color: #fff; font-weight: 700; font-size: 13px; }
.empty { text-align: center; color: #b59a72; padding: 20px; }
</style>
