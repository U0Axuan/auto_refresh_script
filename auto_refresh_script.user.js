// ==UserScript==
// @name         智能定时刷新器
// @namespace    https://github.com/U0Axuan/auto_refresh_script
// @version      2.0.0
// @description  Material Design 3 风格的网页定时刷新工具。支持可拖拽面板、最小化、进度条、最大运行次数限制、可选同域名广播（v2.1 启用）。
// @author       Axuan 薛神
// @license      MIT
// @match        *://*/*
// @exclude      *://accounts.google.com/*
// @exclude      *://*.bank*
// @exclude      */login*
// @exclude      */signin*
// @exclude      */checkout*
// @noframes
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @run-at       document-end
// @icon         https://raw.githubusercontent.com/U0Axuan/auto_refresh_script/main/docs/icon.svg
// ==/UserScript==

/**
 * 智能定时刷新器 - v2.0.0
 * 重构自 v1.0.2：模块化、修复 P0 Bug、加 a11y、默认禁用、单实例保护。
 * 架构说明见 docs/architecture.md。
 */
(function () {
  'use strict';

  // ============================================================
  // 1. CONFIG — 集中常量
  // ============================================================
  const CONFIG = Object.freeze({
    VERSION: '2.0.0',
    SCHEMA_VERSION: 2,
    REFRESH_DEFAULT: 30,
    REFRESH_MIN: 1,
    REFRESH_MAX: 3600,
    MAX_RUNS_MIN: 0,
    MAX_RUNS_MAX: 10000,
    PROGRESS_TICK_MS: 100,
    DRAG_THRESHOLD_PX: 3,
    STORAGE_KEYS: Object.freeze({
      interval: 'refreshInterval',
      maxRuns: 'maxRuns',
      targetTab: 'targetTab',
      isEnabled: 'isEnabled',
      isMinimized: 'isMinimized',
      schemaVersion: 'schemaVersion'
    }),
    CSS_CLASSES: Object.freeze({
      panel: 'refresh-controller',
      minimized: 'minimized',
      selected: 'selected',
      pulsing: 'pulsing'
    }),
    SELECTORS: Object.freeze({
      panel: '.refresh-controller',
      header: '.refresh-header',
      minimizeBtn: '#minimizeBtn',
      enableSwitch: '#enableSwitch',
      intervalInput: '#intervalInput',
      maxRunsInput: '#maxRunsInput',
      targetTabs: 'input[name="targetTab"]',
      tabOptions: '.tab-option',
      startBtn: '#startBtn',
      stopBtn: '#stopBtn',
      resetBtn: '#resetBtn',
      statusInfo: '#statusInfo',
      progressBar: '#progressBar',
      progressFill: '#progressFill'
    }),
    BROADCAST_CHANNEL: 'auto-refresh-script',
    BOOT_FLAG: '__autoRefreshBooted_v2__'
  });

  // ============================================================
  // 2. LOGGER — 轻量日志（仅 ?refreshDebug=1 时输出普通日志）
  // ============================================================
  const Logger = (() => {
    const DEBUG = new URLSearchParams(location.search).has('refreshDebug');
    const prefix = `[AutoRefresh v${CONFIG.VERSION}]`;
    return {
      log: DEBUG ? (...a) => console.log(prefix, ...a) : () => {},
      warn: (...a) => console.warn(prefix, ...a),
      error: (...a) => console.error(prefix, ...a)
    };
  })();

  // ============================================================
  // 3. STORAGE — 封装 GM_setValue，提供默认值、迁移、错误处理
  // ============================================================
  const Storage = (() => {
    const DEFAULTS = Object.freeze({
      [CONFIG.STORAGE_KEYS.interval]: CONFIG.REFRESH_DEFAULT,
      [CONFIG.STORAGE_KEYS.maxRuns]: 0,
      [CONFIG.STORAGE_KEYS.targetTab]: 'current',
      [CONFIG.STORAGE_KEYS.isEnabled]: false,
      [CONFIG.STORAGE_KEYS.isMinimized]: false,
      [CONFIG.STORAGE_KEYS.schemaVersion]: CONFIG.SCHEMA_VERSION
    });

    function get(key, fallback) {
      try {
        const v = GM_getValue(key, DEFAULTS[key]);
        return v === undefined || v === null ? (fallback ?? DEFAULTS[key]) : v;
      } catch (err) {
        Logger.error('Failed to read', key, err);
        return fallback ?? DEFAULTS[key];
      }
    }

    function set(key, value) {
      try {
        GM_setValue(key, value);
      } catch (err) {
        Logger.error('Failed to write', key, err);
      }
    }

    function clamp(v, min, max, fallback) {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    }

    function migrate() {
      const current = Number(get(CONFIG.STORAGE_KEYS.schemaVersion, 0));
      if (current >= CONFIG.SCHEMA_VERSION) return;
      // v1.x → v2：v1 的 targetTab='all' 映射到 v2 的 'same-domain'
      const oldTarget = get(CONFIG.STORAGE_KEYS.targetTab);
      if (oldTarget === 'all') {
        set(CONFIG.STORAGE_KEYS.targetTab, 'same-domain');
      }
      Logger.log('Migrated storage from schema', current, '→', CONFIG.SCHEMA_VERSION);
      set(CONFIG.STORAGE_KEYS.schemaVersion, CONFIG.SCHEMA_VERSION);
    }

    function loadAll() {
      migrate();
      return {
        refreshInterval: clamp(
          get(CONFIG.STORAGE_KEYS.interval),
          CONFIG.REFRESH_MIN, CONFIG.REFRESH_MAX, CONFIG.REFRESH_DEFAULT
        ),
        maxRuns: clamp(
          get(CONFIG.STORAGE_KEYS.maxRuns),
          CONFIG.MAX_RUNS_MIN, CONFIG.MAX_RUNS_MAX, 0
        ),
        targetTab: get(CONFIG.STORAGE_KEYS.targetTab),
        isEnabled: !!get(CONFIG.STORAGE_KEYS.isEnabled),
        isMinimized: !!get(CONFIG.STORAGE_KEYS.isMinimized)
      };
    }

    return { get, set, loadAll, clamp };
  })();

  // ============================================================
  // 4. TIMER — 可清理的 setTimeout + requestAnimationFrame 进度
  // ============================================================
  class RefreshTimer {
    /**
     * @param {(pct: number) => void} onProgress 0-100
     */
    constructor(onProgress) {
      this.onProgress = onProgress;
      this._mainId = null;
      this._rafId = null;
      this._onFire = null;
    }

    schedule(delayMs) {
      this.cancel();
      const startTs = performance.now();
      const tick = (now) => {
        if (this._rafId === null) return;
        const pct = Math.min(100, ((now - startTs) / delayMs) * 100);
        this.onProgress(pct);
        if (pct < 100) {
          this._rafId = requestAnimationFrame(tick);
        }
      };
      this._rafId = requestAnimationFrame(tick);
      this._mainId = setTimeout(() => {
        this._mainId = null;
        this.onProgress(100);
        this._fire();
      }, delayMs);
    }

    onFire(fn) {
      this._onFire = fn;
      return this;
    }

    _fire() {
      if (typeof this._onFire === 'function') this._onFire();
    }

    cancel() {
      if (this._mainId !== null) {
        clearTimeout(this._mainId);
        this._mainId = null;
      }
      if (this._rafId !== null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    }
  }

  // ============================================================
  // 5. STYLES — 内联 CSS（Material Design 3）
  // ============================================================
  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
    @import url('https://fonts.googleapis.com/icon?family=Material+Icons');

    .refresh-controller {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 320px;
      background: #fef7ff;
      border: 1px solid #e8def8;
      border-radius: 28px;
      box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3);
      font-family: 'Roboto', sans-serif;
      z-index: 2147483647;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: #1d1b20;
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
      user-select: none;
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
    .refresh-controller.minimized .refresh-title { display: none; }
    .toggle-btn {
      background: none;
      border: none;
      color: #ffffff;
      cursor: pointer;
      padding: 4px;
      border-radius: 12px;
      transition: background-color 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .toggle-btn:hover { background: rgba(255, 255, 255, 0.1); }
    .toggle-btn:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
    }
    .refresh-content { padding: 20px; display: block; }
    .refresh-controller.minimized .refresh-content { display: none; }

    .form-group { margin-bottom: 16px; }
    .form-label, .tab-selector > legend {
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
    .switch { position: relative; width: 52px; height: 32px; display: inline-block; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: #e8def8;
      transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 16px;
      border: 2px solid #79747e;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 20px; width: 20px;
      left: 4px; bottom: 4px;
      background-color: #79747e;
      transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 50%;
    }
    .switch input:checked + .slider {
      background-color: #6750a4;
      border-color: #6750a4;
    }
    .switch input:checked + .slider:before {
      transform: translateX(20px);
      background-color: #ffffff;
    }
    .switch input:focus-visible + .slider {
      outline: 2px solid #6750a4;
      outline-offset: 2px;
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
      gap: 6px;
    }
    .btn:focus-visible {
      outline: 2px solid #6750a4;
      outline-offset: 2px;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #6750a4; color: #ffffff; }
    .btn-primary:hover:not(:disabled) {
      background: #5a47a1;
      box-shadow: 0 2px 4px 1px rgba(103, 80, 164, 0.3);
    }
    .btn-secondary { background: #e8def8; color: #6750a4; }
    .btn-secondary:hover:not(:disabled) { background: #ddd2ea; }
    .btn-danger { background: #b3261e; color: #ffffff; }
    .btn-danger:hover:not(:disabled) { background: #8c1d18; }
    .btn-row { display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap; }

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
      width: 0%;
    }

    .tab-selector { margin-bottom: 16px; border: 0; padding: 0; }
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
    .tab-option:hover { background: #f3eff4; }
    .tab-option.selected { background: #e8def8; color: #6750a4; }
    .tab-option input[type="radio"] { margin-right: 8px; }
    .material-icons { font-size: 18px; vertical-align: middle; }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.6; }
      100% { opacity: 1; }
    }
    .pulsing { animation: pulse 2s infinite; }

    /* 默认禁用的浮动触发图标：仅在用户未启用时显示 */
    .refresh-trigger {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 24px;
      background: #6750a4;
      color: #ffffff;
      border: none;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      z-index: 2147483647;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    .refresh-trigger:hover { transform: scale(1.05); }
    .refresh-trigger:focus-visible {
      outline: 2px solid #6750a4;
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .refresh-controller, .btn, .toggle-btn, .slider, .slider:before, .progress-fill, .refresh-trigger {
        transition: none;
        animation: none;
      }
      .pulsing { animation: none; }
    }
  `;

  // ============================================================
  // 6. PANEL — UI 模板与挂载
  // ============================================================
  const Panel = (() => {
    function template(state) {
      const cls = CONFIG.CSS_CLASSES;
      return `
        <div class="${cls.panel} ${state.isMinimized ? cls.minimized : ''}"
             role="region" aria-label="智能定时刷新器">
          <div class="refresh-header">
            <h2 class="refresh-title">智能定时刷新器</h2>
            <button id="minimizeBtn" class="toggle-btn"
                    aria-label="${state.isMinimized ? '展开控制面板' : '最小化控制面板'}"
                    aria-expanded="${!state.isMinimized}">
              <i class="material-icons" aria-hidden="true">
                ${state.isMinimized ? 'expand_more' : 'remove'}
              </i>
            </button>
          </div>
          <div class="refresh-content">
            <div id="statusInfo" class="status-info" role="status" aria-live="polite"></div>
            <div id="progressBar" class="progress-bar"
                 role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div id="progressFill" class="progress-fill"></div>
            </div>
            <div class="form-group switch-container">
              <label class="form-label" for="enableSwitch">启用自动刷新</label>
              <label class="switch">
                <input type="checkbox" id="enableSwitch"
                       ${state.settings.isEnabled ? 'checked' : ''}
                       aria-label="启用自动刷新">
                <span class="slider" aria-hidden="true"></span>
              </label>
            </div>
            <div class="form-group">
              <label class="form-label" for="intervalInput">
                刷新间隔（秒，${CONFIG.REFRESH_MIN}-${CONFIG.REFRESH_MAX}）
              </label>
              <input type="number" id="intervalInput" class="form-input"
                     min="${CONFIG.REFRESH_MIN}" max="${CONFIG.REFRESH_MAX}"
                     step="1" value="${state.settings.refreshInterval}">
            </div>
            <div class="form-group">
              <label class="form-label" for="maxRunsInput">
                最大运行次数（0 = 无限制）
              </label>
              <input type="number" id="maxRunsInput" class="form-input"
                     min="${CONFIG.MAX_RUNS_MIN}" max="${CONFIG.MAX_RUNS_MAX}"
                     step="1" value="${state.settings.maxRuns}">
            </div>
            <fieldset class="tab-selector">
              <legend class="form-label">目标标签页</legend>
              <label class="tab-option ${state.settings.targetTab === 'current' ? 'selected' : ''}">
                <input type="radio" name="targetTab" value="current"
                       ${state.settings.targetTab === 'current' ? 'checked' : ''}>
                <i class="material-icons" aria-hidden="true">tab</i>当前标签页
              </label>
              <label class="tab-option ${state.settings.targetTab === 'same-domain' ? 'selected' : ''}">
                <input type="radio" name="targetTab" value="same-domain"
                       ${state.settings.targetTab === 'same-domain' ? 'checked' : ''}>
                <i class="material-icons" aria-hidden="true">tab_unselected</i>所有同域名标签页（v2.1 启用）
              </label>
            </fieldset>
            <div class="btn-row">
              <button id="startBtn" class="btn btn-primary"
                      ${state.isActive ? 'disabled' : ''}>
                <i class="material-icons" aria-hidden="true">play_arrow</i>开始
              </button>
              <button id="stopBtn" class="btn btn-secondary"
                      ${state.isActive ? '' : 'disabled'}>
                <i class="material-icons" aria-hidden="true">stop</i>停止
              </button>
              <button id="resetBtn" class="btn btn-danger">
                <i class="material-icons" aria-hidden="true">refresh</i>重置
              </button>
            </div>
          </div>
        </div>
      `;
    }

    function mount(parent, state) {
      const wrapper = document.createElement('div');
      wrapper.dataset.refreshScript = CONFIG.VERSION;
      wrapper.innerHTML = template(state).trim();
      const root = wrapper.firstElementChild;
      parent.appendChild(root);
      return root;
    }

    function mountTrigger(parent, onEnable) {
      const btn = document.createElement('button');
      btn.id = 'refresh-trigger';
      btn.className = 'refresh-trigger';
      btn.type = 'button';
      btn.setAttribute('aria-label', '启用智能定时刷新器');
      btn.innerHTML = '<i class="material-icons" aria-hidden="true">refresh</i>';
      btn.addEventListener('click', () => {
        btn.remove();
        onEnable();
      }, { once: true });
      parent.appendChild(btn);
      return btn;
    }

    return { mount, mountTrigger, template };
  })();

  // ============================================================
  // 7. DRAG HANDLER — 通用指针拖拽（支持鼠标 + 触屏）
  // ============================================================
  function makeDraggable(targetEl, handleEl) {
    let dragState = null;

    handleEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, input, label, .toggle-btn')) return;
      const rect = targetEl.getBoundingClientRect();
      dragState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: rect.left,
        origTop: rect.top
      };
      try { handleEl.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
      handleEl.addEventListener('pointermove', onMove);
      handleEl.addEventListener('pointerup', onUp, { once: true });
      handleEl.addEventListener('pointercancel', onUp, { once: true });
    });

    function onMove(e) {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const maxLeft = window.innerWidth - targetEl.offsetWidth;
      const maxTop = window.innerHeight - targetEl.offsetHeight;
      const newLeft = Math.max(0, Math.min(maxLeft, dragState.origLeft + dx));
      const newTop = Math.max(0, Math.min(maxTop, dragState.origTop + dy));
      targetEl.style.left = newLeft + 'px';
      targetEl.style.top = newTop + 'px';
      targetEl.style.right = 'auto';
    }

    function onUp(e) {
      if (dragState && e.pointerId === dragState.pointerId) {
        try { handleEl.releasePointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
      }
      dragState = null;
      handleEl.removeEventListener('pointermove', onMove);
    }
  }

  // ============================================================
  // 8. REFRESHER — 控制器
  // ============================================================
  class AutoRefreshController {
    /**
     * @param {HTMLElement} root 已挂载的面板根元素
     */
    constructor(root) {
      this.root = root;
      this.settings = Storage.loadAll();
      this.isActive = false;
      this.currentCount = 0;
      this.timer = new RefreshTimer((pct) => this._updateProgress(pct))
        .onFire(() => this._performRefresh());
      this._bindEvents();
      this._updateUI();
    }

    /** @returns {HTMLElement|null} */
    $(sel) { return this.root.querySelector(sel); }

    _bindEvents() {
      this.$(CONFIG.SELECTORS.minimizeBtn).addEventListener('click', () => this._toggleMinimize());

      this.$(CONFIG.SELECTORS.enableSwitch).addEventListener('change', (e) => {
        this.settings.isEnabled = !!e.target.checked;
        Storage.set(CONFIG.STORAGE_KEYS.isEnabled, this.settings.isEnabled);
        e.target.checked ? this.start() : this.stop();
      });

      this.$(CONFIG.SELECTORS.intervalInput).addEventListener('change', (e) => {
        const v = Storage.clamp(
          e.target.value,
          CONFIG.REFRESH_MIN, CONFIG.REFRESH_MAX, CONFIG.REFRESH_DEFAULT
        );
        e.target.value = v;
        this.settings.refreshInterval = v;
        Storage.set(CONFIG.STORAGE_KEYS.interval, v);
        if (this.isActive) this.start(); // 直接重排 timer
      });

      this.$(CONFIG.SELECTORS.maxRunsInput).addEventListener('change', (e) => {
        const v = Storage.clamp(
          e.target.value,
          CONFIG.MAX_RUNS_MIN, CONFIG.MAX_RUNS_MAX, 0
        );
        e.target.value = v;
        this.settings.maxRuns = v;
        Storage.set(CONFIG.STORAGE_KEYS.maxRuns, v);
      });

      this.root.querySelectorAll(CONFIG.SELECTORS.targetTabs).forEach((radio) => {
        radio.addEventListener('change', (e) => {
          this.settings.targetTab = e.target.value;
          Storage.set(CONFIG.STORAGE_KEYS.targetTab, e.target.value);
          this.root.querySelectorAll(CONFIG.SELECTORS.tabOptions).forEach((t) => {
            t.classList.toggle(CONFIG.CSS_CLASSES.selected, t.contains(e.target));
          });
        });
      });

      this.$(CONFIG.SELECTORS.startBtn).addEventListener('click', () => this.start());
      this.$(CONFIG.SELECTORS.stopBtn).addEventListener('click', () => this.stop());
      this.$(CONFIG.SELECTORS.resetBtn).addEventListener('click', () => this.reset());

      // 快捷键：Alt+R（避开 Ctrl+Shift+R = 浏览器硬刷新）
      document.addEventListener('keydown', (e) => {
        if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.target.matches('input, textarea') && e.key.toLowerCase() === 'r') {
          e.preventDefault();
          this.toggle();
        }
      });

      // 拖拽
      const header = this.$(CONFIG.SELECTORS.header);
      if (header) makeDraggable(this.root, header);
    }

    start() {
      if (this.isActive) return;
      this.isActive = true;
      this.currentCount = 0;
      Storage.set(CONFIG.STORAGE_KEYS.isEnabled, true);
      const sw = this.$(CONFIG.SELECTORS.enableSwitch);
      if (sw) sw.checked = true;
      this._scheduleNext();
      this._updateUI();
    }

    stop() {
      if (!this.isActive) return;
      this.isActive = false;
      this.timer.cancel();
      Storage.set(CONFIG.STORAGE_KEYS.isEnabled, false);
      const sw = this.$(CONFIG.SELECTORS.enableSwitch);
      if (sw) sw.checked = false;
      this._updateUI();
    }

    reset() {
      this.stop();
      this.currentCount = 0;
      this._updateUI();
    }

    toggle() { this.isActive ? this.stop() : this.start(); }

    _toggleMinimize() {
      this.settings.isMinimized = !this.settings.isMinimized;
      Storage.set(CONFIG.STORAGE_KEYS.isMinimized, this.settings.isMinimized);
      this.root.classList.toggle(CONFIG.CSS_CLASSES.minimized, this.settings.isMinimized);
      const btn = this.$(CONFIG.SELECTORS.minimizeBtn);
      if (btn) {
        btn.setAttribute('aria-label', this.settings.isMinimized ? '展开控制面板' : '最小化控制面板');
        btn.setAttribute('aria-expanded', String(!this.settings.isMinimized));
        const icon = btn.querySelector('.material-icons');
        if (icon) icon.textContent = this.settings.isMinimized ? 'expand_more' : 'remove';
      }
    }

    _scheduleNext() {
      const delayMs = this.settings.refreshInterval * 1000;
      this.timer.schedule(delayMs);
    }

    _updateProgress(pct) {
      const fill = this.$(CONFIG.SELECTORS.progressFill);
      if (fill) fill.style.width = pct + '%';
      const bar = this.$(CONFIG.SELECTORS.progressBar);
      if (bar) bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    _performRefresh() {
      if (!this.isActive) return;
      this.currentCount++;
      Logger.log('Refresh tick', this.currentCount);

      if (this.settings.targetTab === 'same-domain') {
        this._broadcastRefresh();
      } else {
        window.location.reload();
        return; // 页面即将卸载，无需继续
      }

      if (this.settings.maxRuns > 0 && this.currentCount >= this.settings.maxRuns) {
        this.stop();
        return;
      }
      this._scheduleNext();
      this._updateUI();
    }

    _broadcastRefresh() {
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel(CONFIG.BROADCAST_CHANNEL);
          ch.postMessage({ type: 'refresh', origin: location.hostname, ts: Date.now() });
          ch.close();
        }
      } catch (err) {
        Logger.warn('BroadcastChannel failed, falling back to current tab', err);
      }
      window.location.reload();
    }

    _updateUI() {
      const status = this.$(CONFIG.SELECTORS.statusInfo);
      const start = this.$(CONFIG.SELECTORS.startBtn);
      const stop = this.$(CONFIG.SELECTORS.stopBtn);
      const maxTxt = this.settings.maxRuns > 0 ? ` / ${this.settings.maxRuns}` : '';
      if (!status) return;
      if (this.isActive) {
        status.textContent = `状态：运行中 | 已刷新：${this.currentCount}${maxTxt} 次 | 间隔：${this.settings.refreshInterval}秒`;
        status.classList.add(CONFIG.CSS_CLASSES.pulsing);
        if (start) start.disabled = true;
        if (stop) stop.disabled = false;
      } else {
        status.textContent = `状态：已停止 | 总计刷新：${this.currentCount}${maxTxt} 次`;
        status.classList.remove(CONFIG.CSS_CLASSES.pulsing);
        if (start) start.disabled = false;
        if (stop) stop.disabled = true;
        this._updateProgress(0);
      }
    }

    destroy() {
      this.timer.cancel();
      this.root.remove();
    }
  }

  // ============================================================
  // 9. BOOTSTRAP — 单实例 + 默认禁用 + SPA 友好
  // ============================================================
  function bootstrap() {
    // iframe 内不跑
    if (window.top !== window) return;

    if (window[CONFIG.BOOT_FLAG]) {
      Logger.warn('Script already booted, skip');
      return;
    }
    window[CONFIG.BOOT_FLAG] = true;

    // 注入样式（只一次）
    if (!document.getElementById('refresh-controller-styles')) {
      const s = document.createElement('style');
      s.id = 'refresh-controller-styles';
      s.textContent = STYLES;
      document.head.appendChild(s);
    }

    const settings = Storage.loadAll();

    // 已启用 → 直接挂面板
    if (settings.isEnabled) {
      const panel = Panel.mount(document.body, {
        settings,
        isActive: false,
        isMinimized: settings.isMinimized
      });
      const controller = new AutoRefreshController(panel);
      // 启动后还原 isEnabled 状态 → 自动开始
      if (settings.isEnabled) controller.start();
      return;
    }

    // 未启用 → 显示浮动触发图标
    Panel.mountTrigger(document.body, () => {
      Storage.set(CONFIG.STORAGE_KEYS.isEnabled, true);
      const panel = Panel.mount(document.body, {
        settings: Storage.loadAll(),
        isActive: false,
        isMinimized: false
      });
      new AutoRefreshController(panel);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();