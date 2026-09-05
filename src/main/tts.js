const { spawn } = require('child_process');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 获取 tts 资源目录
function getTTSDir() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', '..', 'tts');
  }
  return path.join(process.resourcesPath, 'tts');
}

// 获取 piper 可执行文件路径
function getPiperPath() {
  const ttsDir = getTTSDir();
  if (process.platform === 'darwin') {
    const bundled = path.join(ttsDir, 'piper_macos', 'piper');
    if (fs.existsSync(bundled)) return bundled;
  } else if (process.platform === 'win32') {
    const bundled = path.join(ttsDir, 'piper_windows', 'piper.exe');
    if (fs.existsSync(bundled)) return bundled;
  }
  return 'piper';
}

// 获取 piper 模型文件路径
function getPiperModelPath() {
  return path.join(getTTSDir(), 'zh_CN-huayan-medium.onnx');
}

// 临时音频文件计数
let tempCounter = 0;

/**
 * 使用 Edge TTS 合成语音（优先，晓晓女声，声音最自然）
 * @param {string} text - 要合成的文本
 * @param {Object} opts - 选项
 * @param {number} opts.speed - 语速倍率（0.5-2.0，默认1.0）
 * @param {number} opts.volume - 音量（0-1，默认1.0）
 * @returns {Promise<string>} 生成的 mp3 文件路径
 */
function synthesizeWithEdge(text, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!text || !text.trim()) {
      reject(new Error('文本为空'));
      return;
    }

    tempCounter++;
    const tempDir = os.tmpdir();
    const outputFile = path.join(tempDir, `123renzi_edge_${Date.now()}_${tempCounter}.mp3`);

    // 语速转换：edge-tts 用百分比，如 +0%, -15%
    const speedPercent = Math.round(((opts.speed || 1.0) - 1.0) * 100);
    const rateStr = (speedPercent >= 0 ? '+' : '') + speedPercent + '%';

    const args = [
      '--voice', 'zh-CN-XiaoxiaoNeural',
      '--text', text,
      '--write-media', outputFile,
      '--rate', rateStr,
    ];

    const edgeTTS = spawn('edge-tts', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    edgeTTS.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    edgeTTS.on('error', (err) => {
      reject(new Error('启动 edge-tts 失败: ' + err.message));
    });

    edgeTTS.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('edge-tts 退出码 ' + code + ': ' + stderr));
        return;
      }
      if (fs.existsSync(outputFile)) {
        resolve(outputFile);
      } else {
        reject(new Error('Edge TTS 生成音频文件失败'));
      }
    });
  });
}

/**
 * 使用 Piper TTS 合成语音（离线兜底）
 * @param {string} text - 要合成的文本
 * @param {Object} opts - 选项
 * @returns {Promise<string>} 生成的 wav 文件路径
 */
function synthesizeWithPiper(text, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!text || !text.trim()) {
      reject(new Error('文本为空'));
      return;
    }

    const modelPath = getPiperModelPath();
    if (!fs.existsSync(modelPath)) {
      reject(new Error('Piper 模型文件不存在: ' + modelPath));
      return;
    }

    tempCounter++;
    const tempDir = os.tmpdir();
    const outputFile = path.join(tempDir, `123renzi_piper_${Date.now()}_${tempCounter}.wav`);

    const args = [
      '-m', modelPath,
      '-f', outputFile,
      '--length-scale', String(opts.speed ? 1.0 / opts.speed : 1.15),
      '--volume', String(opts.volume || 1.0),
      '--sentence-silence', '0.2',
    ];

    const piper = spawn(getPiperPath(), args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    piper.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    piper.on('error', (err) => {
      reject(new Error('启动 piper 失败: ' + err.message));
    });

    piper.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('piper 退出码 ' + code + ': ' + stderr));
        return;
      }
      if (fs.existsSync(outputFile)) {
        resolve(outputFile);
      } else {
        reject(new Error('Piper 生成音频文件失败'));
      }
    });

    piper.stdin.write(text);
    piper.stdin.end();
  });
}

/**
 * 合成语音（优先 Edge TTS，失败回退到 Piper）
 * @param {string} text - 要合成的文本
 * @param {Object} opts - 选项
 * @returns {Promise<{filePath: string, engine: string}>} 生成的音频文件路径和使用的引擎
 */
async function synthesize(text, opts = {}) {
  // 优先 Edge TTS（晓晓，声音最自然，需联网）
  try {
    const filePath = await synthesizeWithEdge(text, opts);
    return { filePath, engine: 'edge' };
  } catch (e) {
    console.warn('Edge TTS 失败，回退到 Piper:', e.message);
  }

  // 回退 Piper（离线）
  try {
    const filePath = await synthesizeWithPiper(text, opts);
    return { filePath, engine: 'piper' };
  } catch (e) {
    console.warn('Piper 也失败:', e.message);
    throw new Error('所有 TTS 引擎都失败了');
  }
}

/**
 * 清理临时音频文件
 */
function cleanup(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    // 忽略清理错误
  }
}

module.exports = {
  synthesize,
  cleanup,
  synthesizeWithEdge,
  synthesizeWithPiper,
};
