# 架构说明（v2.0.0）

## 概览

v2.0.0 把 v1.x 的"单类单文件"重构为**清晰的模块化 IIFE**。分发仍然是单个 `.user.js` 文件，但内部按职责拆分，便于阅读、测试与未来扩展。

```
┌─────────────────────────────────────────────────────────────┐
│                      IIFE 顶层闭包                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  CONFIG   集中常量（版本/范围/选择器/CSS 类）         │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Logger    带 ?refreshDebug=1 开关的轻量日志         │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Storage   封装 GM_setValue / GM_getValue，提供      │  │
│  │            默认值、clamp、schema 迁移                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  RefreshTimer  setTimeout + requestAnimationFrame    │  │
│  │                主定时 + 进度条；可完整 cancel()      │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  STYLES    Material Design 3 CSS（注入到 <style>）   │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Panel     模板字符串 + mount() + mountTrigger()     │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  makeDraggable   通用指针拖拽（鼠标 + 触屏）         │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  AutoRefreshController  核心状态机                  │  │
│  │    - start / stop / reset / toggle                  │  │
│  │    - _bindEvents / _toggleMinimize                  │  │
│  │    - _scheduleNext / _performRefresh                │  │
│  │    - _broadcastRefresh (v2.1 真·多标签页)           │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  bootstrap  单实例 + 默认禁用 + DOM 就绪检测         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 数据流

### 启动流程
```
DOMContentLoaded (或已就绪)
   │
   ▼
bootstrap()
   │
   ├─ if (window.top !== window) return;          // iframe 跳过
   ├─ if (window[BOOT_FLAG]) return;              // 单实例保护
   ├─ window[BOOT_FLAG] = true;
   ├─ 注入 <style id="refresh-controller-styles">
   │
   ├─ settings = Storage.loadAll()                // 触发 schema 迁移
   │
   ├─ if (settings.isEnabled)
   │     Panel.mount(body, ...) ──► AutoRefreshController(panel) ──► controller.start()
   │
   └─ else
         Panel.mountTrigger(body, () => {        // 仅显示右下角浮动按钮
           Storage.set(isEnabled, true);
           Panel.mount(body, ...) ──► new AutoRefreshController(panel);
         })
```

### 一次刷新 tick 的流程
```
User 切换主开关 ON
   │
   ▼
change event on #enableSwitch
   │
   ▼
controller.start()
   ├─ isActive = true
   ├─ currentCount = 0
   ├─ Storage.set(isEnabled, true)
   ├─ _scheduleNext()
   │     └─ timer.schedule(intervalMs)
   │           ├─ requestAnimationFrame → 每帧更新 progressFill 宽度
   │           └─ setTimeout → 到点触发 _fire()
   └─ _updateUI()

       ⏰ 到点
   │
   ▼
timer._fire() → _performRefresh()
   ├─ currentCount++
   ├─ if (targetTab === 'same-domain') _broadcastRefresh() + reload
   │   else                              window.location.reload()
   ├─ if (maxRuns > 0 && currentCount >= maxRuns) stop() else _scheduleNext()
   └─ _updateUI()
```

### 用户停止
```
User 切换主开关 OFF  或  点击停止按钮  或  Alt+R 快捷键
   │
   ▼
controller.stop()
   ├─ isActive = false
   ├─ timer.cancel()                // 清理 setTimeout + cancelAnimationFrame
   ├─ Storage.set(isEnabled, false)
   └─ _updateUI()
```

---

## 状态机

```
        ┌──────────┐
        │ Disabled │  ← 默认（未启用）
        └────┬─────┘
             │ 用户点击右下角浮动按钮
             ▼
        ┌──────────┐
   ┌───►│   Idle   │  ← 主面板已挂载，未运行
   │    └────┬─────┘
   │         │ start() / 开关 ON
   │         ▼
   │    ┌──────────┐
   │    │ Running  │  ← 正在倒计时 / 刷新
   │    └────┬─────┘
   │         │ stop() / 开关 OFF / maxRuns 达到
   │         ▼
   │    ┌──────────┐
   └────┤   Idle   │
        └──────────┘
```

`reset()` 不改变状态机，只把 `currentCount` 清零并强制 `stop()`。

---

## 关键设计决策

### 1. 为什么不拆分多个文件？
Userscript 的核心分发形态是**单文件**：用户从 GitHub 直接点击安装，不需要 npm / 构建工具。保持单文件意味着零安装摩擦。

但**开发体验**也重要。所以 v2.0：
- 单文件分发：保留
- 模块化：内部用 IIFE 拆为命名空间
- 未来 v2.1：可选引入 `src/*.js` + 简易 build 脚本生成 `.user.js`（仅给开发者用，不影响用户）

### 2. 为什么要默认禁用？
v1.x 的 `@match *://*/*` 在所有页面主动注入面板，会：
- 干扰邮件、网银等敏感页面
- 浪费 DOM 节点
- 引发用户对脚本的信任危机

v2.0 改为默认禁用：未启用时仅在右下角放一个**很小的浮动按钮**（48×48 px），用户主动点击才创建完整面板。这同时给了用户**一个明确的启用入口**，避免了"装上脚本却找不到入口"的尴尬。

### 3. 为什么用 `requestAnimationFrame` 做进度条？
v1.x 用 100ms `setTimeout` 链做进度更新：
- 不精确（与主定时器各自漂移）
- 无法清理（stop() 后还有一堆 setTimeout 在排队）
- 性能浪费（标签页隐藏时浏览器仍会调度）

`requestAnimationFrame`：
- 与显示器刷新率对齐（60fps / 120fps）
- 标签页隐藏时自动暂停
- 可以 `cancelAnimationFrame` 立刻清理

### 4. 为什么是 `Alt+R` 而不是 `Ctrl+Shift+R`？
- `Ctrl+Shift+R` = Chrome / Firefox / Edge 的"硬刷新"快捷键，**浏览器会优先消费** — 根本进不到脚本
- `Alt+R` 不与任何主流浏览器的常用快捷键冲突

### 5. 为什么用 schemaVersion 迁移？
v1.x 改存储键名时，没有用户能平滑升级。v2.0 引入 `schemaVersion: 2`：
- 启动时检查当前 schema 版本
- 如果低于当前版本，运行迁移函数
- 迁移完成后再写入新版本号

这样未来 v3.0 改键名 / 改结构时，旧用户也能无痛升级。

### 6. 为什么不用 XSS 安全的 `textContent` 而是 `innerHTML`？
`Panel.template()` 是**开发者写的固定字符串**（不含用户输入），不是用户数据。XSS 风险仅出现在把用户输入写进 DOM 时——本脚本中 `statusInfo.textContent = ...` 全部用 `textContent` 赋值，所以是安全的。

未来如果加自定义模板功能，必须用 DOM API（`createElement` / `textContent`）替代 `innerHTML`，或者对变量做 `escapeHTML()`。

---

## 性能

- 初始注入：~3ms（IIFE 解析 + DOM 创建）
- 运行期：每帧 O(1)（一个 RAF callback 更新 `width` 样式）
- 内存：~5 KB 长期占用（Timer + Controller + 少量闭包）
- CPU：标签页隐藏时自动降为 0（RAF 暂停）

---

## 浏览器兼容

| 特性 | Chrome | Firefox | Edge | Safari |
|---|---|---|---|---|
| `GM_setValue` | ✅ | ✅ | ✅ | ✅ |
| `BroadcastChannel` | 54+ | 38+ | 79+ | 15.4+ |
| `requestAnimationFrame` | ✅ | ✅ | ✅ | ✅ |
| `pointerdown` 事件 | 55+ | 59+ | 12+ | 13+ |
| `:focus-visible` | 86+ | 85+ | 86+ | 15.4+ |
| `prefers-reduced-motion` | 74+ | 63+ | 79+ | 10.1+ |
| `backdrop-filter` | 76+ | 103+ | 17+ | 9+ |

`@noframes` + 渐进增强保证：在老浏览器上**核心功能**（开始 / 停止 / 计时）仍可工作，只是缺少部分视觉/交互效果。
