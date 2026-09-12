// 背景音乐管理器：单例 Audio 循环播放，教学时自动压低音量
let audio = null;
let currentSrc = '';
let teaching = false;

const NORMAL_VOLUME = 0.35; // 正常游戏音量
const TEACHING_VOLUME = 0.05; // 教学时几乎听不到

function ensureAudio() {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
  }
  return audio;
}

async function play(src) {
  const a = ensureAudio();
  if (currentSrc !== src) {
    currentSrc = src;
    a.src = src;
  }
  try {
    a.volume = teaching ? TEACHING_VOLUME : NORMAL_VOLUME;
    await a.play();
  } catch (e) {
    // autoplay 被浏览器策略拦截：等用户首次点击后 resumeBgm()
  }
}

/** 登录界面背景音 */
export function playLoginBgm() {
  return play('audio/login-bgm.m4a');
}

/** 游戏主体背景音 */
export function playGameBgm() {
  return play('audio/game-bgm.m4a');
}

/** 教学模式：压低背景音几乎听不到；非教学时恢复 */
export function setTeachingMode(on) {
  teaching = !!on;
  if (audio) audio.volume = teaching ? TEACHING_VOLUME : NORMAL_VOLUME;
}

/** 用户交互（点击）时调用，恢复可能被 autoplay 策略拦截的播放 */
export function resumeBgm() {
  if (audio && audio.paused) {
    audio.play().catch(() => {});
  }
}

// 窗口失焦（切到别的 app/窗口）时暂停背景音；重新获得焦点时恢复
if (typeof window !== 'undefined') {
  window.addEventListener('blur', () => {
    if (audio && !audio.paused) {
      audio.pause();
      // 记录是被 blur 暂停的，focus 时恢复
      window.__bgmPausedByBlur = true;
    }
  });
  window.addEventListener('focus', () => {
    if (audio && window.__bgmPausedByBlur) {
      window.__bgmPausedByBlur = false;
      audio.play().catch(() => {});
    }
  });
}
