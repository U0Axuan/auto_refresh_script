// ==UserScript==
// @name         智能定时刷新器
// @namespace    https://github.com/U0Axuan/auto_refresh_script
// @version      1.0.2
// @description  Material Design 3风格的网页定时刷新工具，支持多标签页管理和灵活配置
// @author       Axuan 薛神
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        window.focus
// @run-at       document-end
// @icon         https://api.iconify.design/mingcute:refresh-4-ai-line.svg
// ==/UserScript==

(function() {
    'use strict';

    // Material Design 3 样式
    GM_addStyle(`
        @import url('https://api.fonts.coollabs.io/css2?family=Roboto:wght@300;400;500;700&display=swap');
        @import url('https://api.fonts.coollabs.io/icon?family=Material+Icons');

        .refresh-controller {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            background: #fef7ff;
            border: 1px solid #e8def8;
            border-radius: 28px;
            box-shadow: 0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3);
            font-family: 'Roboto', sans-serif;
            z-index: 10000;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
        }

        .refresh-controller.minimized {
            width: 56px;
            height: 56px;
            border-radius: 28px;
            overflow: hidden;
        }

        .refresh-header {
            display: flex;
            align-items: center;
            padding: 16px 20px;
            background: linear-gradient(135deg, #6750a4 0%, #7c5dfa 100%);
            color: #ffffff;
            border-radius: 28px 28px 0 0;
            cursor: move;
        }

        .refresh-controller.minimized .refresh-header {
            border-radius: 28px;
            padding: 16px;
            justify-content: center;
        }

        .refresh-title {
            flex: 1;
            font-size: 16px;
            font-weight: 500;
            margin: 0;
        }

        .refresh-controller.minimized .refresh-title {
            display: none;
        }

        .toggle-btn {
            background: none;
            border: none;
            color: #ffffff;
            cursor: pointer;
            padding: 4px;
            border-radius: 12px;
            transition: background-color 0.2s;
        }

        .toggle-btn:hover {
            background: rgba(255,255,255,0.1);
        }

        .refresh-content {
            padding: 20px;
            display: block;
        }

        .refresh-controller.minimized .refresh-content {
            display: none;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #49454f;
            margin-bottom: 8px;
        }

        .form-input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #79747e;
            border-radius: 12px;
            font-size: 14px;
            font-family: 'Roboto', sans-serif;
            background: #fef7ff;
            color: #1d1b20;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-sizing: border-box;
        }

        .form-input:focus {
            outline: none;
            border-color: #6750a4;
            box-shadow: 0 0 0 2px rgba(103, 80, 164, 0.2);
        }

        .form-input:disabled {
            background: #f7f2fa;
            color: #9a9999;
            border-color: #c4c7c5;
        }

        .switch-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .switch {
            position: relative;
            width: 52px;
            height: 32px;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #e8def8;
            transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 16px;
            border: 2px solid #79747e;
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 20px;
            width: 20px;
            left: 4px;
            bottom: 4px;
            background-color: #79747e;
            transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 50%;
        }

        input:checked + .slider {
            background-color: #6750a4;
            border-color: #6750a4;
        }

        input:checked + .slider:before {
            transform: translateX(20px);
            background-color: #ffffff;
        }

        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: 'Roboto', sans-serif;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary {
            background: #6750a4;
            color: #ffffff;
        }

        .btn-primary:hover {
            background: #5a47a1;
            box-shadow: 0 2px 4px 1px rgba(103, 80, 164, 0.3);
        }

        .btn-secondary {
            background: #e8def8;
            color: #6750a4;
        }

        .btn-secondary:hover {
            background: #ddd2ea;
        }

        .btn-danger {
            background: #b3261e;
            color: #ffffff;
        }

        .btn-danger:hover {
            background: #8c1d18;
        }

        .btn-row {
            display: flex;
            gap: 12px;
            margin-top: 20px;
        }

        .status-info {
            background: #e6f3ff;
            border: 1px solid #bbdefb;
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 16px;
            font-size: 13px;
            color: #1565c0;
        }

        .progress-bar {
            width: 100%;
            height: 4px;
            background: #e8def8;
            border-radius: 2px;
            overflow: hidden;
            margin-top: 8px;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #6750a4, #7c5dfa);
            transition: width 0.1s linear;
            border-radius: 2px;
        }

        .tab-selector {
            margin-bottom: 16px;
        }

        .tab-option {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            margin: 4px 0;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.2s;
            font-size: 13px;
        }

        .tab-option:hover {
            background: #f3eff4;
        }

        .tab-option.selected {
            background: #e8def8;
            color: #6750a4;
        }

        .tab-option input[type="radio"] {
            margin-right: 8px;
        }

        .material-icons {
            font-size: 13px;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.6; }
            100% { opacity: 1; }
        }

        .pulsing {
            animation: pulse 2s infinite;
        }
    `);

    class AutoRefreshController {
        constructor() {
            this.isActive = false;
            this.interval = null;
            this.currentCount = 0;
            this.settings = this.loadSettings();
            this.isMinimized = GM_getValue('isMinimized', false);
            this.init();
        }

        loadSettings() {
            return {
                refreshInterval: GM_getValue('refreshInterval', 30),
                maxRuns: GM_getValue('maxRuns', 0),
                targetTab: GM_getValue('targetTab', 'current'),
                isEnabled: GM_getValue('isEnabled', false)
            };
        }

        saveSettings() {
            GM_setValue('refreshInterval', this.settings.refreshInterval);
            GM_setValue('maxRuns', this.settings.maxRuns);
            GM_setValue('targetTab', this.settings.targetTab);
            GM_setValue('isEnabled', this.settings.isEnabled);
        }

        init() {
            this.createUI();
            this.bindEvents();
            if (this.settings.isEnabled) {
                this.start();
            }
            this.updateUI();
            this.makeDraggable();
        }

        createUI() {
            this.container = document.createElement('div');
            this.container.className = 'refresh-controller';
            if (this.isMinimized) {
                this.container.classList.add('minimized');
            }

            this.container.innerHTML = `
                <div class="refresh-header">
                    <h3 class="refresh-title">智能定时刷新器</h3>
                    <button class="toggle-btn" id="minimizeBtn">
                        <span class="material-icons">${this.isMinimized ? 'expand_more' : 'remove'}</span>
                    </button>
                </div>
                <div class="refresh-content">
                    <div class="status-info" id="statusInfo">
                        状态：已停止
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill" style="width: 0%"></div>
                        </div>
                    </div>

                    <div class="switch-container">
                        <span class="form-label">启用自动刷新</span>
                        <label class="switch">
                            <input type="checkbox" id="enableSwitch" ${this.settings.isEnabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div class="form-group">
                        <label class="form-label">刷新间隔（秒）</label>
                        <input type="number" class="form-input" id="intervalInput"
                               value="${this.settings.refreshInterval}" min="1" max="3600">
                    </div>

                    <div class="form-group">
                        <label class="form-label">最大运行次数（0=无限制）</label>
                        <input type="number" class="form-input" id="maxRunsInput"
                               value="${this.settings.maxRuns}" min="0" max="10000">
                    </div>

                    <div class="form-group">
                        <label class="form-label">目标标签页</label>
                        <div class="tab-selector">
                            <div class="tab-option ${this.settings.targetTab === 'current' ? 'selected' : ''}">
                                <input type="radio" name="targetTab" value="current"
                                       ${this.settings.targetTab === 'current' ? 'checked' : ''}>
                                <span class="material-icons">tab 当前标签页</span>
                            </div>
                            <div class="tab-option ${this.settings.targetTab === 'all' ? 'selected' : ''}">
                                <input type="radio" name="targetTab" value="all"
                                       ${this.settings.targetTab === 'all' ? 'checked' : ''}>
                                <span class="material-icons">tab_unselected 所有标签页（同域名）</span>
                            </div>
                        </div>
                    </div>

                    <div class="btn-row">
                        <button class="btn btn-primary" id="startBtn">
                            <span class="material-icons">play_arrow<br />开始</span>
                        </button>
                        <button class="btn btn-secondary" id="stopBtn">
                            <span class="material-icons">stop<br />停止</span>
                        </button>
                        <button class="btn btn-danger" id="resetBtn">
                            <span class="material-icons">refresh<br />重置</span>
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(this.container);
        }

        bindEvents() {
            // 最小化/展开按钮
            const minimizeBtn = this.container.querySelector('#minimizeBtn');
            minimizeBtn.addEventListener('click', () => this.toggleMinimize());

            // 开关
            const enableSwitch = this.container.querySelector('#enableSwitch');
            enableSwitch.addEventListener('change', (e) => {
                this.settings.isEnabled = e.target.checked;
                this.saveSettings();
                if (e.target.checked) {
                    this.start();
                } else {
                    this.stop();
                }
            });

            // 输入框
            const intervalInput = this.container.querySelector('#intervalInput');
            intervalInput.addEventListener('change', (e) => {
                this.settings.refreshInterval = parseInt(e.target.value) || 30;
                this.saveSettings();
                if (this.isActive) {
                    this.restart();
                }
            });

            const maxRunsInput = this.container.querySelector('#maxRunsInput');
            maxRunsInput.addEventListener('change', (e) => {
                this.settings.maxRuns = parseInt(e.target.value) || 0;
                this.saveSettings();
            });

            // 标签页选择
            const tabOptions = this.container.querySelectorAll('input[name="targetTab"]');
            tabOptions.forEach(option => {
                option.addEventListener('change', (e) => {
                    this.settings.targetTab = e.target.value;
                    this.saveSettings();

                    // 更新选中状态
                    this.container.querySelectorAll('.tab-option').forEach(tab => {
                        tab.classList.remove('selected');
                    });
                    e.target.closest('.tab-option').classList.add('selected');
                });
            });

            // 按钮
            this.container.querySelector('#startBtn').addEventListener('click', () => this.start());
            this.container.querySelector('#stopBtn').addEventListener('click', () => this.stop());
            this.container.querySelector('#resetBtn').addEventListener('click', () => this.reset());

            // 键盘快捷键
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                    e.preventDefault();
                    this.toggle();
                }
            });
        }

        toggleMinimize() {
            this.isMinimized = !this.isMinimized;
            GM_setValue('isMinimized', this.isMinimized);

            this.container.classList.toggle('minimized', this.isMinimized);
            const minimizeBtn = this.container.querySelector('#minimizeBtn .material-icons');
            minimizeBtn.textContent = this.isMinimized ? 'expand_more' : 'remove';
        }

        makeDraggable() {
            const header = this.container.querySelector('.refresh-header');
            let isDragging = false;
            let startX, startY, startLeft, startTop;

            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('.toggle-btn')) return;

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                const rect = this.container.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                e.preventDefault();
            });

            const handleMouseMove = (e) => {
                if (!isDragging) return;

                const newLeft = startLeft + (e.clientX - startX);
                const newTop = startTop + (e.clientY - startY);

                this.container.style.left = Math.max(0, Math.min(window.innerWidth - this.container.offsetWidth, newLeft)) + 'px';
                this.container.style.top = Math.max(0, Math.min(window.innerHeight - this.container.offsetHeight, newTop)) + 'px';
                this.container.style.right = 'auto';
            };

            const handleMouseUp = () => {
                isDragging = false;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }

        start() {
            if (this.isActive) return;

            this.isActive = true;
            this.currentCount = 0;
            this.settings.isEnabled = true;
            this.saveSettings();

            const enableSwitch = this.container.querySelector('#enableSwitch');
            enableSwitch.checked = true;

            this.scheduleNextRefresh();
            this.updateUI();
        }

        stop() {
            this.isActive = false;
            this.settings.isEnabled = false;
            this.saveSettings();

            const enableSwitch = this.container.querySelector('#enableSwitch');
            enableSwitch.checked = false;

            if (this.interval) {
                clearTimeout(this.interval);
                this.interval = null;
            }
            this.updateUI();
        }

        restart() {
            this.stop();
            setTimeout(() => this.start(), 100);
        }

        reset() {
            this.stop();
            this.currentCount = 0;
            this.updateUI();
        }

        toggle() {
            if (this.isActive) {
                this.stop();
            } else {
                this.start();
            }
        }

        scheduleNextRefresh() {
            if (!this.isActive) return;

            const intervalMs = this.settings.refreshInterval * 1000;
            let timeLeft = intervalMs;

            // 更新进度条
            const updateProgress = () => {
                if (!this.isActive) return;

                const progress = ((intervalMs - timeLeft) / intervalMs) * 100;
                const progressFill = this.container.querySelector('#progressFill');
                if (progressFill) {
                    progressFill.style.width = progress + '%';
                }

                timeLeft -= 100;
                if (timeLeft > 0) {
                    setTimeout(updateProgress, 100);
                }
            };

            updateProgress();

            this.interval = setTimeout(() => {
                this.performRefresh();
            }, intervalMs);
        }

        performRefresh() {
            if (!this.isActive) return;

            this.currentCount++;

            if (this.settings.targetTab === 'current') {
                window.location.reload();
            } else if (this.settings.targetTab === 'all') {
                // 对于所有标签页模式，我们刷新当前页面
                // 注意：由于安全限制，用户脚本无法直接操作其他标签页
                window.location.reload();
            }

            // 检查是否达到最大运行次数
            if (this.settings.maxRuns > 0 && this.currentCount >= this.settings.maxRuns) {
                this.stop();
                return;
            }

            // 继续下一次刷新
            this.scheduleNextRefresh();
            this.updateUI();
        }

        updateUI() {
            const statusInfo = this.container.querySelector('#statusInfo');
            const startBtn = this.container.querySelector('#startBtn');
            const stopBtn = this.container.querySelector('#stopBtn');
            const progressFill = this.container.querySelector('#progressFill');

            if (this.isActive) {
                const maxText = this.settings.maxRuns > 0 ? ` / ${this.settings.maxRuns}` : '';
                statusInfo.innerHTML = `
                    状态：运行中 | 已刷新：${this.currentCount}${maxText} 次 | 间隔：${this.settings.refreshInterval}秒
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill" style="width: 0%"></div>
                    </div>
                `;
                statusInfo.classList.add('pulsing');
                startBtn.disabled = true;
                stopBtn.disabled = false;
            } else {
                const maxText = this.settings.maxRuns > 0 ? ` / ${this.settings.maxRuns}` : '';
                statusInfo.innerHTML = `
                    状态：已停止 | 总计刷新：${this.currentCount}${maxText} 次
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill" style="width: 0%"></div>
                    </div>
                `;
                statusInfo.classList.remove('pulsing');
                startBtn.disabled = false;
                stopBtn.disabled = true;
                if (progressFill) {
                    progressFill.style.width = '0%';
                }
            }
        }
    }

    // 等待页面完全加载后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new AutoRefreshController();
        });
    } else {
        new AutoRefreshController();
    }

})();
