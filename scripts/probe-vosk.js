// 直接测试 vosk-browser createModel 在不同 URL 形式下能否加载完成
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const distRoot = path.join(__dirname, '..', 'dist');
const voskJs = path.join(__dirname, '..', 'node_modules', 'vosk-browser', 'dist', 'vosk.js');
const modelAbs = path.join(distRoot, 'models', 'vosk-model-small-cn-0.22.tar.gz');
const modelFileUrl = 'file://' + modelAbs;

const testHtml = `file://${path.join(__dirname, 'probe-vosk-page.html')}`;

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 900, height: 500, show: true });
  win.webContents.on('console-message', (e, level, message) => {
    console.log('[page]', message);
  });
  win.webContents.on('did-finish-load', async () => {
    const code = `
      new Promise((resolve) => {
        const out = [];
        function run(label, url) {
          return new Promise((r2) => {
            let done = false;
            const timer = setTimeout(() => { if (!done) { done = true; out.push(label + ': 超时(8s)'); r2(); } }, 8000);
            Vosk.createModel(url, 2)
              .then((m) => { if (!done) { done = true; clearTimeout(timer); out.push(label + ': ✅ 加载完成'); r2(); } })
              .catch((e) => { if (!done) { done = true; clearTimeout(timer); out.push(label + ': ❌ ' + e.message); r2(); } });
          });
        }
        (async () => {
          out.push('MODEL_URL=' + ${JSON.stringify(modelFileUrl)});
          await run('createModel(file://)', ${JSON.stringify(modelFileUrl)});
          try {
            const resp = await fetch(${JSON.stringify(modelFileUrl)});
            const buf = await resp.arrayBuffer();
            const blob = new Blob([buf], { type: 'application/gzip' });
            const blobUrl = URL.createObjectURL(blob);
            await run('createModel(blob:)', blobUrl);
          } catch (e) { out.push('构造blob失败: ' + e.message); }
          resolve(out.join('\\n'));
        })();
      })
    `;
    try {
      const result = await win.webContents.executeJavaScript(code);
      const msg = 'vosk createModel 探测:\\n' + result;
      console.log(msg);
      fs.writeFileSync('/tmp/probe-result.txt', msg);
    } catch (e) {
      const msg = '探测失败: ' + e.message;
      console.log(msg);
      fs.writeFileSync('/tmp/probe-result.txt', msg);
    }
    app.exit(0);
  });
  win.loadURL(testHtml);
});
