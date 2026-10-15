# Changelog

所有对项目有显著影响的变更都会记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [2.0.0] - 2026-10-15

> 🔥 **重大重构**。修复多个 P0 Bug，引入模块化架构。**不向后兼容旧版存储键**（已通过 schema 迁移处理）。

### ⚠ Breaking Changes
- 移除 `@grant window.focus` 权限
- 快捷键从 `Ctrl+Shift+R`（与浏览器硬刷新冲突）改为 `Alt+R`
- 默认 `isEnabled = false`：未启用时仅显示右下角浮动触发按钮，不再自动注入主面板
- `targetTab` 取值变更：`'all'` → `'same-domain'`（schema 迁移自动处理）
- 旧版本 `<link rel="stylesheet" href="...fonts.coollabs.io...">` 替换为 Google Fonts CDN
- 进度条由 `setTimeout` 链改为 `requestAnimationFrame`（更平滑，但若有脚本依赖旧定时器 ID 需调整）

### 🐛 Bug Fixes
- 修 `minimizeBtn` 内部 `.material-icons` 选择器导致的潜在 `TypeError`（`textContent` 找不到节点）
- 修 `parseInt(...) || defaultValue` 把合法的 `0` 吞掉（影响"最大运行次数=0"和"间隔=0"场景）
- 修进度条 setTimeout 链在 `stop()` 后无法清理，会留下大量排队回调
- 修 SPA 路由切换 / 重复注入时面板重复挂载
- 修快捷键 `Ctrl+Shift+R` 被浏览器消费的"假工作"问题
- 修 `targetTab === 'all'` 实际只刷当前页的误导性 UI（v2.1 真功能上线前已标注"v2.1 启用"）

### ✨ Features
- 集中 `CONFIG` / `SELECTORS` / `CSS_CLASSES` 常量
- 模块化拆分：`Logger` / `Storage` / `RefreshTimer` / `Panel` / `makeDraggable` / `AutoRefreshController` / `bootstrap`
- `Storage` 模块：GM 封装、默认值、`clamp()` 校验、`schemaVersion` 迁移
- `RefreshTimer` 类：`setTimeout` + `requestAnimationFrame` 双轨，可完整 `cancel()`
- 指针事件（`pointerdown` / `pointermove`）替代 `mousedown` / `mousemove`，触屏友好
- 单实例保护（`window[BOOT_FLAG]`）
- 默认禁用策略：未启用时仅显示右下角浮动按钮，点击后才创建主面板
- `@exclude` 黑名单：`accounts.google.com`、银行、登录、结账
- `@noframes`：iframe 内不执行
- 完整 a11y：`aria-label` / `aria-live="polite"` / `role="progressbar"` / `aria-valuenow` / `aria-expanded`
- `prefers-reduced-motion` 媒体查询：尊重用户的减少动效偏好
- `?refreshDebug=1` 调试开关（URL 参数启用控制台日志）
- BroadcastChannel 通道预留（v2.1 真·同域名刷新时使用）

### ♻ Refactor
- 移除 `@grant window.focus`（避免抢焦，刷新本身已足够）
- `STYLES` 从 `GM_addStyle` 移到 `<style id="refresh-controller-styles">`（更可控、可去重）
- 修复 `z-index: 10000` 过低：提升到 `2147483647`（最高层级）
- 修复 `transition: 0.3s` 单位缺失：补为 `0.3s`
- 补 `box-sizing: border-box` 一致性
- 补 `-webkit-backdrop-filter` Safari 兼容
- 补 `cursor: pointer` / `user-select: none` 等交互一致性
- 补 `form` `<label>` 关联（`for` 属性）

### 📚 Documentation
- 重写 `README.md`，加入徽章、架构图、开发指南、路线图
- 新增 `CHANGELOG.md`（本文件）
- 新增 `docs/architecture.md`、`docs/api.md`
- 新增 `CONTRIBUTING.md`、`SECURITY.md`、`LICENSE`（MIT）
- 代码内全面 JSDoc 注释

### 🔧 Tooling
- 新增 `.eslintrc.json`、`.prettierrc.json`、`.editorconfig`
- 新增 `.github/workflows/lint.yml`（CI：ESLint + Prettier）
- 新增 `package.json`（dev-only）
- 新增 `test/manual-checklist.md`

---

## [1.0.2] - 2025-06-11

### Fixed
- 修复 Material Icons 字体加载（从 iconify 切换到 coollabs CDN）
- 优化 UI 交互细节

## [1.0.0] - 2025-06-11

### Added
- 首次发布
- Material Design 3 风格控制面板
- 定时刷新 + 进度条
- 可拖拽 / 可最小化
- 配置自动保存
- 键盘快捷键
