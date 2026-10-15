# Contributing to 智能定时刷新器

感谢你的兴趣！欢迎通过 Issue / PR 贡献。

## 🐛 报告 Bug

提交 Issue 前请确认：
1. 已搜索现有 Issue，避免重复
2. 复现步骤清晰
3. 提供：浏览器、脚本管理器版本、URL、控制台错误（如有）

模板：
```markdown
**环境**
- 浏览器：Chrome 130
- 脚本管理器：Violentmonkey 2.20
- 脚本版本：v2.0.0

**复现步骤**
1. 打开 https://example.com?refreshDebug=1
2. 点击右下角浮动按钮
3. 设置间隔为 5 秒
4. 点击开始

**预期**
每 5 秒刷新一次

**实际**
无反应 / 报错
```

## 💡 提 Feature Request

请说明：
- 要解决什么问题
- 期望的交互 / UI
- 是否愿意自己实现 + 发 PR

## 🔧 提交 PR

### 流程
1. Fork 仓库
2. 创建特性分支：`git checkout -b feat/xxx`
3. 提交：`git commit -m "feat: 描述"`
4. Push：`git push origin feat/xxx`
5. 在 GitHub 上发 PR

### 提交信息规范（Conventional Commits）
```
feat: 新增暗色模式
fix: 修复 stop() 后残留 setTimeout
docs: 更新 README
style: 调整 button padding
refactor: 拆分 Storage 模块
test: 添加 clamp() 单测
chore: 升级 ESLint 到 9
```

### 代码规范
- JavaScript：ES2022
- 缩进：2 空格
- 引号：单引号
- 行尾分号：是
- 最大行长：120
- 命名：camelCase（变量 / 函数）、PascalCase（类）、UPPER_SNAKE_CASE（常量）

提交前：
```bash
npm install
npm run lint
npm run format:check
```

## 🌐 翻译

v2.1 计划引入 i18n。届时欢迎贡献：
- 英文 README
- 日文 README
- 繁体中文 README

## 📦 发布流程（维护者）

1. 更新 `CHANGELOG.md` 顶部版本段
2. 提升 `CONFIG.VERSION`
3. 本地跑 `npm run lint && npm test`
4. 提交 + 打 tag：`git tag v2.x.y`
5. Push tag → GitHub Actions 自动发布 Release

## 🧪 测试

当前（v2.0）以**手动 checklist** 为主，单元测试计划在 v3.0 引入。

手动测试清单见 [test/manual-checklist.md](../test/manual-checklist.md)。
