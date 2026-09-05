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
  // 优先用打包进去的 piper 二进制
  if (process.platform === 'darwin') {
    const bundled = path.join(ttsDir, 'piper_macos', 'piper');
    if (fs.existsSync(bundled)) return bundled;
  } else if (process.platform === 'win32') {
    const bundled = path.join(ttsDir, 'piper_windows', 'piper.exe');
    if (fs.existsSync(bundled)) return bundled;
  } else {
    const bundled = path.join(ttsDir, 'piper_linux', 'piper');
    if (fs.existsSync(bundled)) return bundled;
  }
  // 兜底：用系统 PATH 中的 piper
  return 'piper';
}

// 获取模型文件路径
function getModelPath() {
  return path.join(getTTSDir(), 'zh_CN-huayan-medium.onnx');
}

// 临时音频文件计数
let tempCounter = 0;

/**
 * 使用 Piper TTS 合成语音
 * @param {string} text - 要合成的文本
 * @param {Object} opts - 选项
 * @param {number} opts.speed - 语速（0.5-2.0，默认1.0）
 * @param {number} opts.volume - 音量（0-1，默认1.0）
 * @returns {Promise<string>} 生成的 wav 文件路径
 */
function synthesize(text, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!text || !text.trim()) {
      reject(new Error('文本为空'));
      return;
    }

    const modelPath = getModelPath();
    if (!fs.existsSync(modelPath)) {
      reject(new Error('TTS 模型文件不存在: ' + modelPath));
      return;
    }

    // 创建临时输出文件
    tempCounter++;
    const tempDir = os.tmpdir();
    const outputFile = path.join(tempDir, `123renzi_tts_${Date.now()}_${tempCounter}.wav`);

    const args = [
      '-m', modelPath,
      '-f', outputFile,
      '--length-scale', String(opts.speed ? 1.0 / opts.speed : 1.15),
      '--volume', String(opts.volume || 1.0),
      '--sentence-silence', '0.2',
    ];

    const piperPath = getPiperPath();
    const piper = spawn(piperPath, args, {
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
        reject(new Error('生成音频文件失败'));
      }
    });

    // 写入文本到 stdin
    piper.stdin.write(text);
    piper.stdin.end();
  });
}

/**
 * 清理临时音频文件
 * @param {string} filePath - 要删除的文件路径
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
  getModelPath,
  getPiperPath,
};
