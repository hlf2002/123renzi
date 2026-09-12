// 语音识别服务：基于 vosk-browser（Kaldi WASM，完全本地离线）
// 流程：加载模型 → 采集麦克风（16kHz 单声道）→ 喂给识别器 → 静音/超时自动停止 → 返回识别文本
import { createModel } from 'vosk-browser';

// 模型 URL：用页面地址推导绝对路径。
// 生产(file:// 页面) → file:///.../dist/models/... （Electron 渲染进程 fetch file:// 可用，vosk 已验证）
// dev(vite server)  → http://localhost:5173/models/... （public/ 映射）
const MODEL_URL = new URL('models/vosk-model-small-cn-0.22.tar.gz', window.location.href).href;
const SAMPLE_RATE = 16000;

let modelPromise = null;
let model = null;

/** 加载模型（懒加载，全局只加载一次） */
export function ensureModel() {
  if (model) return Promise.resolve(model);
  if (!modelPromise) {
    modelPromise = createModel(MODEL_URL)
      .then((m) => {
        model = m;
        return m;
      })
      .catch((e) => {
        modelPromise = null; // 失败后允许重试
        throw e;
      });
  }
  return modelPromise;
}

/**
 * 一次性识别：等待用户朗读，静音或超时后自动结束
 * @param {Object} opts
 * @param {Function} [opts.onPartial] 实时识别中间结果的回调 (text) => void
 * @param {number} [opts.silenceMs] 连续静音多久判定说完（默认 1600ms，孩子朗读停顿多）
 * @param {number} [opts.maxMs] 最长录音时长（默认 12s）
 * @returns {Promise<string>} 识别文本（可能为空串）
 */
export async function recognizeOnce({ onPartial, silenceMs = 1600, maxMs = 12000 } = {}) {
  const m = await ensureModel();
  const rec = new m.KaldiRecognizer(SAMPLE_RATE);
  let stream = null;
  let audioCtx = null;
  let source = null;
  let processor = null;

  try {
    const result = await new Promise((resolve, reject) => {
      let finalText = '';
      let settled = false;
      let lastVoiceAt = Date.now();
      let timer = null;

      const done = () => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          // retrieveFinalResult 同步返回最终结果，优先用它的返回值（不依赖事件时序）
          const fr = rec.retrieveFinalResult();
          if (fr && fr.result && typeof fr.result.text === 'string' && fr.result.text.trim()) {
            finalText = fr.result.text;
          }
        } catch (e) {
          /* ignore */
        }
        resolve(finalText.trim());
      };

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (processor) {
          try { processor.disconnect(); } catch (e) { /* ignore */ }
        }
        if (source) {
          try { source.disconnect(); } catch (e) { /* ignore */ }
        }
        if (audioCtx) {
          try { audioCtx.close(); } catch (e) { /* ignore */ }
        }
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
      };

      rec.on('result', (msg) => {
        if (msg && msg.result && typeof msg.result.text === 'string') {
          finalText = msg.result.text;
        }
      });
      rec.on('partialresult', (msg) => {
        if (msg && msg.result && typeof msg.result.partial === 'string' && msg.result.partial) {
          if (onPartial) onPartial(msg.result.partial);
        }
      });
      rec.on('error', (msg) => {
        if (!settled) reject(new Error(msg && msg.error ? msg.error : '语音识别出错'));
      });

      // 超时保护
      timer = setTimeout(done, maxMs);

      navigator.mediaDevices
        .getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
            sampleRate: SAMPLE_RATE,
          },
        })
        .then((s) => {
          if (settled) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          stream = s;
          audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
          source = audioCtx.createMediaStreamSource(stream);
          processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (event) => {
            const input = event.inputBuffer.getChannelData(0);
            // 喂给识别器（若实际采样率不是 16k，先降采样）
            const data = audioCtx.sampleRate === SAMPLE_RATE ? input : resample(input, audioCtx.sampleRate, SAMPLE_RATE);
            try {
              rec.acceptWaveformFloat(data, SAMPLE_RATE);
            } catch (e) {
              /* ignore */
            }
            // 静音检测
            let energy = 0;
            for (let i = 0; i < input.length; i += 8) energy += input[i] * input[i];
            energy /= input.length / 8;
            const rms = Math.sqrt(energy);
            if (rms > 0.012) lastVoiceAt = Date.now();
            else if (Date.now() - lastVoiceAt > silenceMs && Date.now() - lastVoiceAt < maxMs) {
              // 已说完：给识别器一点消化时间
              done();
            }
          };
          source.connect(processor);
          processor.connect(audioCtx.destination);
        })
        .catch((e) => {
          if (!settled) reject(new Error('无法使用麦克风：' + (e && e.message ? e.message : e)));
        });
    });

    return result;
  } catch (e) {
    // 确保资源释放
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (audioCtx) { try { audioCtx.close(); } catch (_) { /* ignore */ } }
    throw e;
  } finally {
    try { rec.remove(); } catch (e) { /* ignore */ }
  }
}

/** 线性插值降采样到 16k */
function resample(input, fromRate, toRate) {
  const ratio = toRate / fromRate;
  const outLen = Math.round(input.length * ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i / ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[Math.min(idx, input.length - 1)];
    const b = input[Math.min(idx + 1, input.length - 1)];
    out[i] = a + (b - a) * frac;
  }
  return out;
}
