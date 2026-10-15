# 智能定时刷新器 · Auto Refresh Script

一个功能完整、界面美观的网页自动刷新工具，采用 Material Design 3 设计规范。

[![Version](https://img.shields.io/badge/version-2.0.0-6750a4)](https://github.com/U0Axuan/auto_refresh_script/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Userscript](https://img.shields.io/badge/userscript-violentmonkey-orange)](https://violentmonkey.github.io/)
[![JS Standard](https://img.shields.io/badge/style-ES2022-yellow)](https://262.ecma-international.org/13.0/)

> v2.0.0 是对 v1.x 的一次彻底重构。修复了多个 P0 Bug、把单文件拆为清晰的逻辑模块、加了 a11y 与默认禁用策略、引入 schema 化存储与迁移机制。详见 [CHANGELOG](CHANGELOG.md)。

---

## ✨ 功能特性

### 🎯 核心
- ⏱ **可调刷新间隔** — 1 ~ 3600 秒
- 🔢 **最大运行次数** — 0 表示无限
- 🪟 **可拖拽 / 可最小化面板** — 不打扰主操作
- 📊 **实时进度条** — 用 `requestAnimationFrame` 平滑渲染
- 💾 **配置自动持久化** — 通过 `GM_setValue` 跨会话保存

### 🛡 v2.0 新增
- 🚫 **默认禁用** — 不再在所有页面主动注入面板；仅显示一个右下角浮动按钮，用户点击后才启用
- 🔒 **敏感站点排除** — 自动跳过 `accounts.google.com`、银行、登录、结账等路径
- ♿ **无障碍 (a11y)** — 全部控件带 `aria-label` / `role`，支持键盘聚焦与 `prefers-reduced-motion`
- 📦 **存储 Schema 迁移** — 旧版本配置自动升级到 v2，不会丢设置
- 🧹 **可清理定时器** — 100% cleanup，无残留 `setTimeout`
- 🪞 **单实例保护** — SPA / 重复注入时不会创建多份面板

### 🧪 技术改进
- 集中常量（`CONFIG`、`SELECTORS`、`CSS_CLASSES`）
- 模块化：`Logger` / `Storage` / `RefreshTimer` / `Panel` / `AutoRefreshController` / `bootstrap`
- 零运行时依赖，~22 KB 单文件分发
- 兼容 Violentmonkey / Tampermonkey / Greasemonkey

---

## 🚀 安装

### 方法 1：直接安装（推荐）
1. 安装浏览器扩展：
   - [Violentmonkey](https://violentmonkey.github.io/)（推荐）
   - [Tampermonkey](https://www.tampermonkey.net/)
   - [Greasemonkey](https://www.greasespot.net/)（Firefox）
2. 打开 [`auto_refresh_script.user.js`](./auto_refresh_script.user.js)
3. 浏览器扩展会弹出安装确认 → 点击 **确认安装**

### 方法 2：手动安装
1. 打开脚本管理器面板
2. 新建脚本 → 粘贴文件内容 → 保存

### 方法 3：从 CDN 安装
```text
https://raw.githubusercontent.com/U0Axuan/auto_refresh_script/main/auto_refresh_script.user.js
```

---

## 📖 使用说明

### 第一次使用
v2.0 默认是 **禁用** 状态。安装后，**页面右下角**会出现一个紫色圆形刷新按钮。

点击该按钮 → 启用脚本 → 出现主控制面板。

### 控制面板
```
┌─────────────────────────────┐
│  智能定时刷新器        [-] │  ← 标题栏（可拖拽）
├─────────────────────────────┤
│ 状态：运行中 | 已刷新：3次   │  ← 状态信息
│ ████████░░ 80%             │  ← 进度条
├─────────────────────────────┤
│ 启用自动刷新        [●]    │  ← 主开关
│ 刷新间隔（秒）  [30    ]   │
│ 最大运行次数    [0     ]   │  ← 0 = 无限制
│ 目标标签页：              │
│ ● 当前标签页              │
│ ○ 所有同域名标签页（v2.1）│
├─────────────────────────────┤
│ [开始] [停止] [重置]       │
└─────────────────────────────┘
```

### 操作
| 操作 | 说明 |
|---|---|
| 拖拽标题栏 | 移动面板到屏幕任意位置 |
| 点击 `[-]` | 最小化为 56×56 圆角 |
| 切换主开关 | 立即启动 / 停止刷新 |
| 修改配置 | 实时生效，无需重启 |
| 点击 `重置` | 停止并清零计数 |
| 快捷键 `Alt+R` | 快速启动 / 停止 |

> ⚠ **快捷键变更**：v1.x 的 `Ctrl+Shift+R` 与浏览器硬刷新冲突，已废弃。v2.0 改为 `Alt+R`，避开系统快捷键。

---

## ⚙️ 配置项

| 配置 | 默认 | 范围 | 说明 |
|---|---|---|---|
| 刷新间隔 | 30 秒 | 1-3600 | 两次刷新间等待时间 |
| 最大运行次数 | 0（无限）| 0-10000 | 达到后自动停止 |
| 目标标签页 | 当前 | current / same-domain | 同域名模式将在 v2.1 启用 |
| 启用 | false | bool | 默认禁用（v2.0 行为） |
| 最小化 | false | bool | 是否以最小化形态启动 |

存储键：
```
refreshInterval · maxRuns · targetTab · isEnabled · isMinimized · schemaVersion
```

---

## 🔐 权限说明

| 权限 | 用途 | 必需 |
|---|---|---|
| `GM_setValue` / `GM_getValue` / `GM_deleteValue` | 跨会话保存配置 | ✅ |
| `GM_addStyle` | （v2.0 改用 `<style>` 注入，仍保留兼容） | — |
| `run-at document-end` | 等待主文档解析完成再注入 | ✅ |
| `@match *://*/*` | 匹配所有 HTTP(S) 页面 | ✅ |
| `@exclude` | 自动跳过敏感页面 | ✅ |
| `@noframes` | 在 iframe 中不执行 | ✅ |

> v1.x 申请的 `window.focus` 权限已在 v2.0 移除 — 刷新行为本身已足以让窗口前置，主动抢焦会打断用户工作。

---

## 🧩 架构

v2.0 把单文件 IIFE 拆成 6 个内部模块（仍单文件分发，保持安装体验）：

```
┌─ CONFIG（集中常量）
├─ Logger（带 ?refreshDebug=1 开关）
├─ Storage（GM 封装 + schema 迁移 + clamp）
├─ RefreshTimer（setTimeout + RAF 进度，可 cancel）
├─ Panel（HTML 模板 + 挂载 + 触发图标）
├─ makeDraggable（指针拖拽，鼠标 + 触屏）
├─ AutoRefreshController（核心状态机）
└─ bootstrap（单实例 + 默认禁用 + DOM 就绪）
```

详见 [docs/architecture.md](docs/architecture.md)。

---

## 🛠 开发

### 仓库结构
```
auto_refresh_script/
├── auto_refresh_script.user.js      ← 分发产物（单文件）
├── README.md
├── CHANGELOG.md
├── LICENSE
├── docs/
│   ├── architecture.md              ← 模块划分 + 数据流
│   ├── api.md                       ← JSDoc 导出的 API
│   └── icon.svg                     ← 脚本图标
├── src/                             ← 模块化参考实现（v2.1 计划拼接为单文件）
├── test/
│   └── manual-checklist.md          ← 手动验证清单
├── .github/workflows/lint.yml       ← ESLint + Prettier CI
├── .eslintrc.json
├── .prettierrc.json
└── package.json
```

### Lint（本地）
```bash
npm install
npm run lint
npm run format:check
```

### Debug
在 URL 后加 `?refreshDebug=1` 即可打开控制台日志：
```text
https://example.com/page?refreshDebug=1
```

---

## 🐛 已知问题 / 路线图

- [ ] **v2.1** — 用 `BroadcastChannel` 真正实现"同域名所有标签页"模式
- [ ] **v2.1** — 国际化（中 / 英）
- [ ] **v2.2** — 暗色主题 + 主题切换
- [ ] **v2.2** — 站点规则引擎（白 / 黑名单 URL 模式）
- [ ] **v3.0** — 配置导入 / 导出 JSON
- [ ] **v3.0** — 单元测试（Vitest + JSDOM）

---

## 🤝 贡献

欢迎 Issue / PR。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

提交 PR 前请运行：
```bash
npm run lint
npm test
```

---

## 🔒 安全

如发现安全漏洞，请勿公开 Issue，请按 [SECURITY.md](SECURITY.md) 流程私信报告。

---

## 📄 许可

[MIT](LICENSE) © Axuan 薛神

---

## 🙏 致谢

- Material Design 3 设计规范
- Roboto 字体（Google Fonts）
- Material Icons（Google Fonts）
- Violentmonkey / Tampermonkey 社区
