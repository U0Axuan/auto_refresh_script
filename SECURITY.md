# 安全策略

## 支持的版本

| 版本 | 支持 |
|---|---|
| v2.x | ✅ 积极维护 |
| v1.x | ⚠ 关键安全问题修复（仅） |
| < v1.0 | ❌ 不再支持 |

## 报告漏洞

**请勿在公开 Issue 中报告安全漏洞。**

请通过以下方式私下报告：
- **GitHub Security Advisories**（推荐）：[创建私密报告](https://github.com/U0Axuan/auto_refresh_script/security/advisories/new)
- **邮件**：u0axuan@gmail.com（PGP 加密优先，详见下文）

### 报告内容请包含

1. 漏洞描述与影响范围
2. 复现步骤
3. 受影响版本
4. 概念验证（PoC）代码或截图
5. （可选）建议的修复方案

### 我们的承诺

- 收到报告后 **48 小时内**确认
- 评估后 **7 天内**给出修复时间表
- 修复发布后**公开致谢**（如你同意）
- 严重漏洞处理周期不超过 **30 天**

## 已知安全考量

本脚本运行在**用户浏览器内最高权限**上下文（Greasy Fork / Violentmonkey），因此对以下方面保持高度警惕：

### 1. XSS
所有用户输入（虽然目前没有）必须经 `textContent` 写入 DOM，**禁止 `innerHTML` 拼接用户数据**。
`Panel.template()` 是开发者字符串，不含用户输入，但未来添加自定义模板时需重新审视。

### 2. 权限申请
每个 `@grant` 都有理由，删除不需要的权限。
v2.0 删除了 v1.x 的 `window.focus`（抢焦是骚扰行为）。

### 3. 远程代码
- 字体从 Google Fonts CDN 加载（v1.x 用了 `coollabs.io`，已替换）
- 不加载任何远程 JS
- 不 eval / new Function
- 不使用 `document.write`

### 4. 存储
- 仅使用 `GM_setValue` / `GM_getValue`（脚本管理器隔离的存储）
- 不访问 `localStorage` / `cookie`
- 存储内容仅限用户配置（数字 / 布尔 / 字符串），不含页面数据

### 5. 网络请求
脚本**不会**主动发起任何 fetch / XHR。刷新是浏览器原生 `window.location.reload()`，不经过脚本。

### 6. 第三方依赖
**零运行时依赖**。这是有意为之，避免供应链攻击。

### 7. CSP 兼容
脚本不依赖 `unsafe-inline` 也不依赖 `unsafe-eval`。
样式通过 `<style>` 元素注入（与 `unsafe-inline` 等价的另一种方式，是浏览器允许的）。

## 致谢

以下安全研究员对本项目做出过贡献（按时间顺序）：

（暂无）
