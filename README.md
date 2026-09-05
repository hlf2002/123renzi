# 123认字 · 开发交付说明

> 在阅读句子中认字、遵循遗忘规律、持续评估自适应的儿童识字游戏（Electron + Vue3 + SQLite）。
> 本文件为开发阶段的运行说明、验证证据与迭代记录。

## 一、快速开始

```bash
cd 123renzi

# 1. 安装依赖（Electron 二进制较大，见下方「macOS 安全拦截说明」）
npm install

# 2. 构建渲染层（Vue3 → dist/）
npm run build:renderer

# 3. 启动应用（Electron 加载 dist/index.html）
npm start
```

开发模式（热更新）：`npm run dev` 起 Vite，另开终端 `ELECTRON_ENABLE_LOGGING=1 npx electron .`（主进程会加载 `VITE_DEV_SERVER_URL` 指向 5173）。

## 二、测试与验证

```bash
npm test            # 核心逻辑单元测试（纯 Node，不依赖 Electron）
npm run smoke       # Electron 冒烟：建用户→会话→提交→等级/设置/进度全链路
npm run test:sqlite # Electron 环境 SQLite 验证（内存库 + 文件持久化重启）
npm run dist        # electron-builder 打包（macOS dmg + Windows NSIS 配置）
```

### 当前验证结果（2026-09-05）

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 单元测试（四仓库升降级/持续评估跳级降级/载体演进/组词约束/年级映射/多用户隔离/设置） | `npm test` | **34/34 通过** |
| Electron 冒烟（IPC 全链路 + Vue 挂载） | `npm run smoke` | **PASS** |
| SQLite 验证（内存库流程 + 文件持久化重启 + 间隔配置持久化） | `npm run test:sqlite` | **PASS（8/8）** |
| electron-builder 打包（mac app 目录） | `npx electron-builder --dir --mac` | 成功，产物可启动 |

## 三、目录结构

```
123renzi/
├── src/
│   ├── main/            # Electron 主进程
│   │   ├── index.js     # 窗口创建 + 生命周期
│   │   ├── db.js        # SQLite 初始化 + 核心组装
│   │   └── ipc.js       # IPC 注册（window.api ↔ 核心）
│   ├── preload/         # contextBridge 桥接（contextIsolation）
│   ├── core/            # 纯 Node 核心逻辑（可单测）
│   │   ├── index.js     # 领域组装：会话/提交/进度/设置
│   │   ├── scheduler.js # 四仓库记忆调度（升降级 + 间隔）
│   │   ├── engine.js    # 持续评估（跳级/降级/难度段/激励）
│   │   ├── content.js   # 字库包加载 + 载体判定 + 组词句
│   │   ├── levels.js    # 年级基线 + 超越同龄人百分比
│   │   ├── storage.js   # 存储接口 + 内存实现
│   │   └── sqlite-store.js # better-sqlite3 实现
│   ├── renderer/        # Vue3 渲染层
│   │   ├── views/       # LoginView / GameView / ParentView
│   │   └── components/  # WarehouseBar / LearnCard
│   └── assets/content/grade1/  # 一年级字库包（121 字 / 48 词句）
├── scripts/             # smoke.js / test-sqlite.js
├── tests/               # 单元测试
└── tools/gen-grade1.js  # 字库包生成脚本（含字表自校验）
```

## 四、已实现功能（对照策划案 12 项决策）

1. 游戏名称「123认字」——✓
2. 只要求认识、不考核书写——✓（仅点选/朗读，无书写输入）
3. 一机多人、独立进度；儿童点头像一键进入，家长入口 PIN——✓
4. 初次认识的字直接进第四仓库（+30 天低频抽查兜底）——✓
5. 字库排序以统编教材为主线——✓（首版一年级示例包，后续按教材核对导入）
6. 首版一年级字库包——✓
7. 复习间隔 W1 当天+次日 / W2 +3 / W3 +7 / W4 +30，家长面板可配——✓
8. 载体阶段阈值 <100 单字 / 100~500 词 / 500~1200 短句 / 1200+ 完整句子——✓
9. 连续 5 次全对自动跳级、连续 3 次答错降级——✓
10. 无独立摸底、持续评估（评估融入学习、探测字每 5 题 1 个）——✓
11. 超越同龄人百分比 = 本地基准模型估算（正态分布），界面标注口径——✓
12. 家长账号与云同步——**后续版本**（首版本地 SQLite 多用户）

## 五、macOS 安全拦截说明（重要）

macOS 26 的 Gatekeeper/XProtect 会把「未公证 + 网络下载」的 Electron 二进制当作威胁清除或 SIGKILL。
本项目已通过以下方式处理并验证：

- **升级 Electron 31 → 40.10.2**：新版避免触发旧版未签名 dylib 的拦截规则；
- **better-sqlite3 11 → 13.0.3 + `@electron/rebuild`**：适配 Electron 40 的新版 V8 API；
- 下载后移除 `com.apple.quarantine` 属性并做 ad-hoc 重签（`codesign --force --deep --sign -`）。

若打包后的 `.app` 首次运行仍被拦截：右键图标 →「打开」，或在「系统设置 → 隐私与安全性」中点击「仍要打开」。正式分发建议购买 Apple Developer 账号做公证（notarization）。

## 六、已知限制与后续

- **字库**：`grade1` 包为贴近部编版一年级的**示例数据**（121 字/48 词句），非真实教材字表；`stroke_count` 为占位。需按策划案 8.3 分批导入真实字表（含拼音/笔画/词句）。
- **语音**：学习卡朗读依赖系统中文语音包（Electron 内置 TTS）；无语音时静默降级为拼音展示。
- **家长账号与云同步**：未做（已确认后续版本）。
- **Windows 打包**：NSIS 配置已就绪，需在 Windows 环境或 CI 执行 `npm run dist` 产出安装包。
- **测试环境**：better-sqlite3 重编译为 Electron ABI 后，宿主 Node 的 `node --test` 不再加载 SQLite 测试（避免段错误），SQLite 验证改由 `npm run test:sqlite`（Electron 环境）承担。

## 七、迭代记录

1. 核心逻辑初版 → 测试暴露「W1 当天/隔天复测未区分」→ 引入 `stage` 字段修正，测试全绿。
2. 集成测试暴露「pickNewChars 传对象给 buildItems」→ 改为传 char_id 数组，出题正常。
3. SQLite `recent` 字段未反序列化 → 增加 JSON 解析，内存/SQLite 行为一致。
4. Electron 31 二进制被 macOS XProtect 清除 + 运行时 SIGKILL → 升级 Electron 40 并 ad-hoc 重签。
5. better-sqlite3 11 与 Electron 40 的 V8 API 不兼容 → 升级 13.0.3 并 `electron-rebuild`。
6. 打包链路：electron-builder 配置完成，`--dir --mac` 产物验证可启动。
