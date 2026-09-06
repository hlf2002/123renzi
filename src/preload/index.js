'use strict';
/**
 * preload：通过 contextBridge 暴露安全的 window.api。
 * 渲染层不得直接访问 Node/Electron。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (payload) => ipcRenderer.invoke('users:create', payload),
    remove: (userId) => ipcRenderer.invoke('users:delete', userId),
  },
  session: {
    get: (userId) => ipcRenderer.invoke('session:get', userId),
    submit: (userId, results) => ipcRenderer.invoke('session:submit', userId, results),
  },
  progress: {
    get: (userId) => ipcRenderer.invoke('progress:get', userId),
  },
  level: {
    get: (userId) => ipcRenderer.invoke('level:get', userId),
  },
  logs: {
    get: (userId) => ipcRenderer.invoke('logs:get', userId),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  teacher: {
    teach: (char, context) => ipcRenderer.invoke('teacher:teach', char, context),
  },
  tts: {
    synthesize: (text, opts) => ipcRenderer.invoke('tts:synthesize', text, opts),
    cleanup: (filePath) => ipcRenderer.invoke('tts:cleanup', filePath),
  },
});
