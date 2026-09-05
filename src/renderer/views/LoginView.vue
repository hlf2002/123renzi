<template>
  <div class="login">
    <div class="hero">
      <h1>123认字</h1>
      <p class="sub">在句子和词语里，轻轻松松认识越来越多的字！</p>
    </div>

    <div class="user-grid">
      <div v-for="u in users" :key="u.user_id" class="user-card">
        <button class="avatar-btn" @click="enter(u)">
          <span class="avatar">{{ AVATARS[(u.avatar_id - 1 + AVATARS.length) % AVATARS.length] }}</span>
          <span class="nick">{{ u.nickname }}</span>
        </button>
        <button class="del" title="删除这个小朋友" @click="remove(u)">✕</button>
      </div>

      <button class="add-card" @click="showAdd = true">
        <span class="add-plus">＋</span>
        <span class="add-text">添加小朋友</span>
      </button>
    </div>

    <button class="parent-entry" @click="openParent">家长入口</button>

    <!-- 添加小朋友弹窗 -->
    <div v-if="showAdd" class="mask" @click.self="showAdd = false">
      <div class="dialog">
        <h3>新来的小朋友，你叫什么名字？</h3>
        <input v-model="newName" maxlength="12" placeholder="输入昵称" @keyup.enter="createUser" />
        <div class="avatar-pick">
          <button
            v-for="(a, i) in AVATARS"
            :key="i"
            class="pick"
            :class="{ on: i + 1 === newAvatar }"
            @click="newAvatar = i + 1"
          >{{ a }}</button>
        </div>
        <div class="dialog-actions">
          <button class="btn ghost" @click="showAdd = false">算了</button>
          <button class="btn primary" @click="createUser">开始学</button>
        </div>
      </div>
    </div>

    <!-- 家长 PIN 弹窗 -->
    <div v-if="showPin" class="mask" @click.self="showPin = false">
      <div class="dialog">
        <h3>家长入口</h3>
        <p class="pin-tip">请输入家长密码（默认 123456）</p>
        <input v-model="pin" type="password" maxlength="8" @keyup.enter="checkPin" />
        <div class="dialog-actions">
          <button class="btn ghost" @click="showPin = false">取消</button>
          <button class="btn primary" @click="checkPin">进入</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, AVATARS, PARENT_PIN } from '../store';

const router = useRouter();
const users = ref([]);
const showAdd = ref(false);
const newName = ref('');
const newAvatar = ref(1);
const showPin = ref(false);
const pin = ref('');

async function load() {
  if (!api) return;
  users.value = await api.users.list();
}
onMounted(load);

function enter(u) {
  router.push(`/game/${u.user_id}`);
}
async function createUser() {
  const name = newName.value.trim();
  if (!name) return;
  await api.users.create({ nickname: name, avatarId: newAvatar.value, role: 'child' });
  newName.value = '';
  showAdd.value = false;
  await load();
}
async function remove(u) {
  if (!confirm(`确定删除 ${u.nickname} 的学习记录吗？`)) return;
  await api.users.remove(u.user_id);
  await load();
}
function openParent() {
  showPin.value = true;
}
function checkPin() {
  if (pin.value === PARENT_PIN) {
    showPin.value = false;
    pin.value = '';
    router.push('/parent');
  } else {
    alert('密码不对哦，去问问爸爸妈妈吧～');
  }
}
</script>

<style scoped>
.login {
  min-height: 100%;
  padding: 40px 24px 90px;
  text-align: center;
  background: radial-gradient(circle at 30% 10%, #ffe9c7 0%, #fff7ea 55%, #fffdf6 100%);
}
.hero h1 {
  font-size: 46px;
  color: #d94f2b;
  margin: 0;
  letter-spacing: 4px;
  font-weight: 900;
}
.sub { color: #8a6d3b; font-size: 16px; margin: 8px 0 30px; }
.user-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  justify-content: center;
  max-width: 760px;
  margin: 0 auto;
}
.user-card { position: relative; width: 128px; }
.avatar-btn {
  background: #fff;
  border: 3px solid #ffcf87;
  border-radius: 22px;
  width: 128px;
  height: 148px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  transition: transform 0.12s;
}
.avatar-btn:hover { transform: translateY(-4px); }
.avatar { font-size: 56px; }
.nick { font-size: 17px; font-weight: 700; color: #5a4630; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.del {
  position: absolute;
  top: -8px; right: -8px;
  width: 26px; height: 26px;
  border-radius: 50%;
  border: none;
  background: #e8a87c;
  color: #fff;
  font-size: 13px;
  line-height: 1;
}
.add-card {
  width: 128px;
  height: 148px;
  border: 3px dashed #e0b878;
  border-radius: 22px;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #c58f3f;
}
.add-plus { font-size: 40px; font-weight: 300; }
.add-text { font-size: 15px; font-weight: 600; }
.parent-entry {
  position: fixed;
  left: 18px; bottom: 18px;
  border: none;
  background: #efe2cd;
  color: #8a6d3b;
  border-radius: 16px;
  padding: 8px 16px;
  font-size: 13px;
}
.mask {
  position: fixed; inset: 0;
  background: rgba(60, 40, 10, 0.35);
  display: flex; align-items: center; justify-content: center;
  z-index: 10;
}
.dialog {
  background: #fff;
  border-radius: 24px;
  padding: 26px 28px;
  width: 340px;
  text-align: center;
}
.dialog h3 { color: #5a4630; margin: 0 0 14px; }
.pin-tip { color: #a08a66; font-size: 13px; margin: 0 0 10px; }
.dialog input {
  width: 100%;
  padding: 12px;
  border: 2px solid #f0d9b0;
  border-radius: 14px;
  font-size: 16px;
  text-align: center;
  outline: none;
}
.avatar-pick { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 14px 0; }
.pick {
  font-size: 26px;
  width: 44px; height: 44px;
  border-radius: 12px;
  border: 2px solid #eee;
  background: #fff;
}
.pick.on { border-color: #d94f2b; background: #fff0e6; }
.dialog-actions { display: flex; gap: 12px; justify-content: center; margin-top: 6px; }
.btn { border: none; border-radius: 14px; padding: 10px 22px; font-size: 15px; font-weight: 700; }
.btn.ghost { background: #f0ece4; color: #8a6d3b; }
.btn.primary { background: #ffb347; color: #fff; }
</style>
