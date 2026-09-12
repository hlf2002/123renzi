// 探测 Web Speech API 在 Electron 中是否可用
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 500, height: 400, show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <html><body style="font-family:sans-serif;padding:20px">
    <h2>语音识别探测</h2>
    <div id="log" style="white-space:pre-wrap"></div>
    <script>
      const log = document.getElementById('log');
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { log.textContent = '❌ 不支持 SpeechRecognition'; return; }
      log.textContent = '✅ API 存在，正在尝试启动识别（会请求麦克风权限）...\\n';
      const r = new SR();
      r.lang = 'zh-CN';
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (e) => {
        log.textContent += '\\n🎤 识别结果: ' + e.results[0][0].transcript;
      };
      r.onerror = (e) => {
        log.textContent += '\\n❌ 错误: ' + e.error + ' (' + e.message + ')';
      };
      r.onend = () => { log.textContent += '\\n(end)'; };
      try { r.start(); } catch (e) { log.textContent += '\\n⚠️ start异常: ' + e.message; }
    </script>
    </body></html>
  `));
});
