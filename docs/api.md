# API 参考（v2.0.0）

本文档面向**扩展开发者**：未来 v2.1+ 计划把 IIFE 拆到 `src/*.js` 后，这些模块将以 ES Module 形式导出。本文档描述当前的内部 API 形状，便于重构时保持兼容。

> ⚠ 当前版本（v2.0.0）所有符号都在 IIFE 闭包内，**不暴露到 `window`**。本文件是"为未来准备"的契约文档。

---

## 顶层常量 `CONFIG`

```js
const CONFIG = Object.freeze({
  VERSION: '2.0.0',
  SCHEMA_VERSION: 2,
  REFRESH_DEFAULT: 30,
  REFRESH_MIN: 1,
  REFRESH_MAX: 3600,
  MAX_RUNS_MIN: 0,
  MAX_RUNS_MAX: 10000,
  PROGRESS_TICK_MS: 100,
  STORAGE_KEYS: { ... },
  CSS_CLASSES: { ... },
  SELECTORS: { ... },
  BROADCAST_CHANNEL: 'auto-refresh-script',
  BOOT_FLAG: '__autoRefreshBooted_v2__'
});
```

---

## `Logger`

| 方法 | 说明 |
|---|---|
| `Logger.log(...args)` | 仅当 `?refreshDebug=1` 时输出到 `console.log` |
| `Logger.warn(...args)` | 始终输出到 `console.warn` |
| `Logger.error(...args)` | 始终输出到 `console.error` |

所有日志自动带 `[AutoRefresh v2.0.0]` 前缀。

---

## `Storage`

### `Storage.get(key, fallback?) → any`
读取存储值，失败时返回 `DEFAULTS[key]` 或 `fallback`。

### `Storage.set(key, value)`
写入存储值，失败时仅 `Logger.error` 不抛错。

### `Storage.clamp(v, min, max, fallback) → number`
数值校验 + 范围裁剪。

### `Storage.loadAll() → { refreshInterval, maxRuns, targetTab, isEnabled, isMinimized }`
加载全部用户配置，自动触发 schema 迁移。

### 内部：`migrate()`
检查 `schemaVersion` 并按需升级旧版本数据。

---

## `class RefreshTimer`

```js
const timer = new RefreshTimer((pct /* 0-100 */) => { ... });
timer.onFire(() => { ... });
timer.schedule(delayMs);   // 启动一次延时触发
timer.cancel();            // 取消定时 + 进度 RAF
```

### 内部结构
- `setTimeout` 负责到点触发 `_fire()`
- `requestAnimationFrame` 负责进度条平滑更新
- `cancel()` 同时清理两者

---

## `Panel`

### `Panel.template(state) → string`
生成 HTML 字符串。`state` 形状：
```ts
{
  settings: { refreshInterval, maxRuns, targetTab, isEnabled, isMinimized },
  isActive: boolean,
  isMinimized: boolean
}
```

### `Panel.mount(parent, state) → HTMLElement`
把面板挂载到 `parent`，返回根元素。根元素上带 `data-refresh-script="2.0.0"`。

### `Panel.mountTrigger(parent, onEnable) → HTMLButtonElement`
挂载右下角浮动触发按钮（默认禁用状态显示）。点击后调用 `onEnable` 并自我销毁。

---

## `makeDraggable(targetEl, handleEl)`

让 `targetEl` 通过 `handleEl` 拖拽。
- 鼠标 + 触屏均支持（用 Pointer Events）
- 拖拽时自动吸附到视口边界
- 拖拽结束时自动清理事件监听

---

## `class AutoRefreshController`

### 构造
```js
new AutoRefreshController(root)
```
- `root`: 已挂载的面板根元素

### 公共方法
| 方法 | 说明 |
|---|---|
| `start()` | 启动刷新循环（幂等） |
| `stop()` | 停止刷新循环（幂等） |
| `reset()` | 停止并清零计数 |
| `toggle()` | 在 start / stop 间切换 |
| `destroy()` | 销毁面板、清理定时器 |

### 内部方法（带 `_` 前缀）
| 方法 | 说明 |
|---|---|
| `_bindEvents()` | 一次性绑定所有 DOM 事件 |
| `_toggleMinimize()` | 切换最小化状态 + 更新 aria |
| `_scheduleNext()` | 计算下一次延时并启动 timer |
| `_updateProgress(pct)` | 更新进度条宽度 + aria-valuenow |
| `_performRefresh()` | 到点执行刷新 |
| `_broadcastRefresh()` | 通过 BroadcastChannel 通知其他标签页 |
| `_updateUI()` | 同步 DOM（状态文本、按钮可用性） |

### 状态字段
| 字段 | 类型 | 说明 |
|---|---|---|
| `root` | `HTMLElement` | 面板根 |
| `settings` | `object` | 从 `Storage.loadAll()` 加载 |
| `isActive` | `boolean` | 是否正在运行 |
| `currentCount` | `number` | 已刷新次数 |
| `timer` | `RefreshTimer` | 定时器实例 |

---

## `bootstrap()`

无返回值，无参数。幂等（通过 `window[CONFIG.BOOT_FLAG]` 防重入）。

### 行为
1. 在 iframe 中 → 跳过
2. 已 boot 过 → 跳过
3. 注入 `<style id="refresh-controller-styles">`
4. 加载 settings
5. 若 `isEnabled` → 直接创建主面板并 `start()`
6. 否则 → 显示右下角浮动触发按钮

### 调用时机
通过 `DOMContentLoaded` 或同步执行（取决于 `document.readyState`）。

---

## 事件总线（v2.1 计划）

未来考虑引入 `EventTarget` 做模块间解耦：
```js
controller.addEventListener('tick', (e) => console.log(e.detail.count));
controller.dispatchEvent(new CustomEvent('settings:changed', { detail: { ... } }));
```
当前 v2.0 直接走方法调用，未引入。

---

## 扩展点

### 1. 自定义样式
修改 `STYLES` 字符串即可，或在面板挂载后用 CSS-in-JS 注入。

### 2. 替换刷新方式
重写 `AutoRefreshController._performRefresh()`：
- 改成 `fetch(location.href)` 后 `document.documentElement.innerHTML = ...` 实现"无闪烁刷新"
- 改成 SPA 路由 `history.replaceState` 触发 `popstate`

### 3. 集成网站白/黑名单
在 `bootstrap()` 中根据 `location.hostname` 决定是否创建面板。

### 4. 自定义存储后端
替换 `Storage.get / set` 为 IndexedDB / `localStorage` 实现，跨标签页同步更可靠。
