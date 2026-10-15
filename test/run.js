// 轻量单元测试：用 Node 内置 node:test，无需外部依赖
// 仅测试纯函数；浏览器 DOM 相关逻辑通过 test/manual-checklist.md 手动验证。
// 运行：node test/run.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

/* ============================================================
 * 重现 IIFE 内的纯函数（与源码保持一致）
 * 真实脚本里这些在闭包内——这里提取出来便于测试
 * ============================================================ */

const REFRESH_MIN = 1;
const REFRESH_MAX = 3600;
const MAX_RUNS_MIN = 0;
const MAX_RUNS_MAX = 10000;

function clamp(v, min, max, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function getStorage() {
  const store = {};
  return {
    get: (k, d) => (k in store ? store[k] : d),
    set: (k, v) => { store[k] = v; }
  };
}

const STORAGE_KEYS = {
  interval: 'refreshInterval',
  maxRuns: 'maxRuns',
  targetTab: 'targetTab',
  isEnabled: 'isEnabled',
  isMinimized: 'isMinimized',
  schemaVersion: 'schemaVersion'
};

const DEFAULTS = {
  [STORAGE_KEYS.interval]: 30,
  [STORAGE_KEYS.maxRuns]: 0,
  [STORAGE_KEYS.targetTab]: 'current',
  [STORAGE_KEYS.isEnabled]: false,
  [STORAGE_KEYS.isMinimized]: false,
  [STORAGE_KEYS.schemaVersion]: 2
};

function loadAll(storage, SCHEMA_VERSION) {
  // migrate
  const current = Number(storage.get(STORAGE_KEYS.schemaVersion, 0));
  if (current < SCHEMA_VERSION) {
    const oldTarget = storage.get(STORAGE_KEYS.targetTab);
    if (oldTarget === 'all') storage.set(STORAGE_KEYS.targetTab, 'same-domain');
    storage.set(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
  }
  return {
    refreshInterval: clamp(storage.get(STORAGE_KEYS.interval), REFRESH_MIN, REFRESH_MAX, 30),
    maxRuns: clamp(storage.get(STORAGE_KEYS.maxRuns), MAX_RUNS_MIN, MAX_RUNS_MAX, 0),
    targetTab: storage.get(STORAGE_KEYS.targetTab),
    isEnabled: !!storage.get(STORAGE_KEYS.isEnabled),
    isMinimized: !!storage.get(STORAGE_KEYS.isMinimized)
  };
}

/* ============================================================
 * clamp()
 * ============================================================ */

test('clamp: 接受范围内的整数', () => {
  assert.equal(clamp(30, 1, 3600, 30), 30);
  assert.equal(clamp(1, 1, 3600, 30), 1);
  assert.equal(clamp(3600, 1, 3600, 30), 3600);
});

test('clamp: 超出范围被裁剪', () => {
  assert.equal(clamp(0, 1, 3600, 30), 1);
  assert.equal(clamp(0, 0, 10000, 0), 0);  // maxRuns 允许 0
  assert.equal(clamp(99999, 1, 3600, 30), 3600);
  assert.equal(clamp(-5, 1, 3600, 30), 1);
});

test('clamp: NaN / 字符串 / null 用 fallback', () => {
  assert.equal(clamp(NaN, 1, 3600, 30), 30);
  assert.equal(clamp('abc', 1, 3600, 30), 30);
  assert.equal(clamp(null, 1, 3600, 30), 30);
  assert.equal(clamp(undefined, 1, 3600, 30), 30);
});

test('clamp: 浮点数会被裁剪（向上取整到 max，向下到 min）', () => {
  assert.equal(clamp(30.7, 1, 3600, 30), 30.7);  // 不取整
  assert.equal(clamp(3600.5, 1, 3600, 30), 3600);
});

/* ============================================================
 * loadAll() — 默认值
 * ============================================================ */

test('loadAll: 空存储返回所有默认值', () => {
  const s = getStorage();
  const r = loadAll(s, 2);
  assert.equal(r.refreshInterval, 30);
  assert.equal(r.maxRuns, 0);
  assert.equal(r.targetTab, 'current');
  assert.equal(r.isEnabled, false);
  assert.equal(r.isMinimized, false);
});

/* ============================================================
 * loadAll() — schema 迁移
 * ============================================================ */

test('loadAll: v1.x 的 targetTab="all" 迁移到 "same-domain"', () => {
  const s = getStorage();
  s.set('targetTab', 'all');
  s.set('schemaVersion', 1);
  const r = loadAll(s, 2);
  assert.equal(r.targetTab, 'same-domain');
  assert.equal(s.get('schemaVersion'), 2);
});

test('loadAll: v2 schema 不再迁移', () => {
  const s = getStorage();
  s.set('targetTab', 'current');
  s.set('schemaVersion', 2);
  const r = loadAll(s, 2);
  assert.equal(r.targetTab, 'current');
  assert.equal(s.get('schemaVersion'), 2);
});

/* ============================================================
 * loadAll() — 越界值被 clamp
 * ============================================================ */

test('loadAll: 存储中的越界值被 clamp', () => {
  const s = getStorage();
  s.set('refreshInterval', 99999);
  s.set('maxRuns', -100);
  s.set('schemaVersion', 2);
  const r = loadAll(s, 2);
  assert.equal(r.refreshInterval, 3600);
  assert.equal(r.maxRuns, 0);  // clamp 到 min
});

/* ============================================================
 * 验证 DEFAULTS 完整
 * ============================================================ */

test('DEFAULTS 覆盖所有 STORAGE_KEYS', () => {
  for (const k of Object.values(STORAGE_KEYS)) {
    assert.ok(k in DEFAULTS, `Missing default for ${k}`);
  }
});
