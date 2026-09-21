import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cases, modules, caseLibraryMeta } from '../preview/data.js';
import * as experience from '../preview/case-experience.js';

const require = createRequire(import.meta.url);
const service = require('../miniprogram/services/cases');
const mini = require('../miniprogram/data/cases');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
};
const caseIds = new Set(cases.map(item => item.id));
const nodeIds = new Set([...modules.map(item => item.id), ...cases.flatMap(item => item.nodes.map(node => node.id))]);

test('web access, tag and keyword filters compose across all 100 cases', () => {
  assert.equal(experience.filterCases(cases).length, 100);
  assert.equal(experience.filterCases(cases, { access: 'free' }).length, 100);
  assert.equal(experience.filterCases(cases, { access: 'paid' }).length, 0);
  assert.equal(experience.filterCases(cases, { keyword: ` ${cases[0].title.toUpperCase()} ` }).length, 1);
  assert.ok(experience.filterCases(cases, { access: 'free', tag: cases[0].tags[0] }).every(item => !item.locked && item.tags.includes(cases[0].tags[0])));
  assert.equal(experience.filterCases(cases, { keyword: 'definitely-no-such-case' }).length, 0);
});

test('mini filters match web counts and pagination without overlap', async () => {
  for (const access of ['all', 'free', 'paid']) {
    const first = await service.list({ access, page: 1, pageSize: 10 });
    const next = await service.list({ access, page: 2, pageSize: 10 });
    assert.equal(first.total, experience.filterCases(cases, { access }).length);
    assert.equal(new Set([...first.list, ...next.list].map(item => item.id)).size, first.list.length + next.list.length);
  }
  const found = await service.list({ keyword: ` ${cases[0].title} `, access: 'free', tag: cases[0].tags[0] });
  assert.equal(found.total, 1);
  assert.equal((await service.list({ keyword: 'missing-unique-xyz' })).total, 0);
});

test('case nodes retain exact methods, reuse and unique case identity in mixed canvas', () => {
  const ids = ['exposure', cases[0].nodes[0].id, cases[1].nodes[0].id, cases[0].nodes[0].id, 'unknown'];
  const nodes = experience.resolveCanvasNodes(ids, cases, modules);
  assert.equal(nodes.length, 3);
  assert.equal(nodes[1].hint, cases[0].nodes[0].method);
  assert.equal(nodes[1].reuse, cases[0].nodes[0].reuse);
  assert.equal(nodes[2].sourceCaseId, cases[1].id);
  assert.notEqual(nodes[1].id, nodes[2].id);
  assert.ok(mini.cases[0].nodes.every(item => item.sourceCaseId === cases[0].id && item.costStatus === 'not_individually_estimated'));
});

test('favorites and recent cases persist and support saved-only filtering', () => {
  const store = storage();
  const state = { favorites: [cases[0].id, cases[20].id], recentCases: [cases[20].id, cases[0].id], canvasNodes: [cases[0].nodes[0].id], validationChecks: Array(7).fill(true), validationNotes: Array(7).fill('记录'), validationDecision: 'adjust' };
  assert.equal(experience.saveWorkspace(store, state), true);
  const saved = experience.readWorkspace(store, caseIds, nodeIds);
  assert.deepEqual(saved, state);
  assert.equal(experience.filterCases(cases, { savedOnly: true, favorites: saved.favorites }).length, 2);
  assert.equal(experience.filterCases(cases, { savedOnly: true, favorites: saved.favorites, access: 'free' }).length, 2);
});

test('corrupt, stale and denied storage does not break browsing', () => {
  const store = storage();
  store.setItem('qingchuang.workspace.v1', '{broken');
  assert.deepEqual(experience.readWorkspace(store, caseIds, nodeIds), {});
  store.setItem('qingchuang.workspace.v1', JSON.stringify({ favorites: ['missing', 'real_001', 'real_001'], canvasNodes: ['unknown', 'real_001_stage_1'], recentCases: cases.map(item => item.id), validationNotes: [42], validationDecision: 'bad' }));
  const recovered = experience.readWorkspace(store, caseIds, nodeIds);
  assert.deepEqual(recovered.favorites, ['real_001']);
  assert.deepEqual(recovered.canvasNodes, ['real_001_stage_1']);
  assert.equal(recovered.recentCases.length, 12);
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(experience.readWorkspace(denied, caseIds, nodeIds), {});
  assert.equal(experience.saveWorkspace(denied, {}), false);
});

test('source links accept only HTTP and HTTPS', () => {
  assert.equal(experience.safeSourceUrl('javascript:alert(1)'), '');
  assert.equal(experience.safeSourceUrl('file:///private'), '');
  assert.equal(experience.safeSourceUrl('https://example.com/a'), 'https://example.com/a');
});

function pageWithQueue() {
  let specification;
  const requests = [];
  const filename = new URL('../miniprogram/pages/cases/cases.js', import.meta.url);
  const realRequire = createRequire(filename);
  vm.runInNewContext(read('../miniprogram/pages/cases/cases.js'), {
    require: path => path === '../../services/cases' ? { availableTags: service.availableTags, list: options => new Promise((resolve, reject) => requests.push({ options, resolve, reject })) } : realRequire(path),
    Page: value => { specification = value; }, setTimeout, clearTimeout,
  });
  const page = { ...specification, data: { ...specification.data }, setData(values, callback) { Object.assign(this.data, values); callback?.(); } };
  return { page, requests };
}

test('mini discards stale responses and stale errors after rapid filtering', async () => {
  const { page, requests } = pageWithQueue();
  const old = page.fetch(true);
  page.data.access = 'free';
  const latest = page.fetch(true);
  requests[1].resolve({ list: [{ id: 'new' }], total: 20 }); await latest;
  requests[0].reject(new Error('stale')); await old;
  assert.equal(page.data.list[0].id, 'new');
  assert.equal(page.data.error, false);
  assert.equal(page.data.loading, false);
});

test('mini prevents duplicate load-more and ignores completion after unload', async () => {
  const { page, requests } = pageWithQueue();
  page.data.loading = false; page.data.total = 30;
  const pending = page.fetch(false);
  page.loadMore(); page.loadMore();
  assert.equal(requests.length, 1);
  page.onUnload();
  requests[0].resolve({ list: [{ id: 'late' }], total: 30 }); await pending;
  assert.equal(page.data.list.length, 0);
});

test('mini reset clears keyword, tag and access together', async () => {
  const { page, requests } = pageWithQueue();
  page.data.keyword = 'coffee'; page.data.tag = 'unknown'; page.data.access = 'paid';
  page.resetFilters();
  assert.equal(requests[0].options.keyword, '');
  assert.equal(requests[0].options.tag, '全部');
  assert.equal(requests[0].options.access, 'all');
  requests[0].resolve({ list: [], total: 0 });
  await Promise.resolve();
});

test('mini case-to-canvas merges with the current draft instead of overwriting it', () => {
  let specification;
  const values = new Map();
  const storageMock = { read: (key, fallback) => values.has(key) ? values.get(key) : fallback, write: (key, value) => values.set(key, value), appendUnique() {}, removeById() {} };
  const filename = new URL('../miniprogram/pages/case-detail/case-detail.js', import.meta.url);
  const realRequire = createRequire(filename);
  vm.runInNewContext(read('../miniprogram/pages/case-detail/case-detail.js'), {
    require: path => path === '../../utils/storage' ? storageMock : realRequire(path),
    Page: value => { specification = value; }, getApp: () => ({ globalData: {} }), wx: {},
  });
  const existingNode = { id: 'custom_existing', type: 'exposure', name: '已有节点', cost: 0, risk: 0, difficulty: 1 };
  const { createWorkflow } = require('../miniprogram/utils/validation');
  values.set('canvasNodes', [existingNode]);
  values.set('activeWorkflow', createWorkflow({ title: '我的现有草案', nodes: [existingNode] }));
  const page = { ...specification, data: { item: mini.cases[0] } };
  const workflow = page.activateWorkflow();
  assert.equal(workflow.title, '我的现有草案');
  assert.equal(values.get('canvasNodes').length, 8);
  assert.equal(values.get('canvasNodes')[0].id, existingNode.id);
  assert.ok(values.get('canvasNodes').some(node => node.id === mini.cases[0].nodes[0].id));
});

test('web controller renders real data and persists case-to-canvas without a browser', () => {
  const listeners = {};
  const app = { innerHTML: '', focus() {} };
  const toast = { textContent: '', classList: { add() {}, remove() {} } };
  const context = vm.createContext({ ...experience, cases, modules, caseLibraryMeta,
    dnaTheme: { chains: { A: { color: 'gold', label: 'A' }, B: { color: 'cyan', label: 'B' } }, stages: {} },
    stageForNode: () => ({ color: 'gold' }), describeNode: node => node,
    document: { querySelector: selector => selector === '#app' ? app : selector === '#toast' ? toast : null, querySelectorAll: () => [], addEventListener: (name, callback) => { listeners[name] = callback; } },
    window: { addEventListener() {}, confirm: () => true }, localStorage: storage(),
    createUniverse: () => () => {}, createDnaScene: () => ({ destroy() {}, setSelected() {} }),
    URL, setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: () => 1,
  });
  vm.runInContext(read('../preview/app.js').replace(/^import .*;\r?\n/gm, ''), context);
  const run = source => vm.runInContext(source, context);
  run('switchTab("cases")');
  assert.equal((app.innerHTML.match(/class="case-card /g) || []).length, 100);
  run('state.caseAccess = "free"; renderCases()');
  assert.equal((app.innerHTML.match(/class="case-card /g) || []).length, 100);
  run('state.caseAccess = "paid"; renderCases()');
  assert.equal((app.innerHTML.match(/class="case-card /g) || []).length, 100, 'stale paid access state cannot hide the newly free library');
  assert.equal(run('state.caseAccess'), 'all');
  assert.ok(!app.innerHTML.includes('data-access='));
  run('openCase("real_001")');
  assert.ok(app.innerHTML.includes('依据与实验边界'));
  assert.ok(app.innerHTML.includes('case-to-canvas'));
  const before = run('state.canvasNodes.length');
  listeners.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'case-to-canvas' } } : null } });
  assert.equal(run('state.canvasNodes.length'), before + 7);
  assert.ok(app.innerHTML.includes('来自：'));
  assert.ok(app.innerHTML.includes('待核算'));
  assert.ok(app.innerHTML.includes(experience.resolveCanvasNodes(['real_001_stage_1'], cases, modules)[0].sourceTitle));
  run('openCase("real_021")');
  assert.ok(app.innerHTML.includes('id="dna-canvas"'));
  assert.ok(app.innerHTML.includes('data-action="case-to-canvas"'));
  assert.ok(app.innerHTML.includes(cases[20].nodes[6].method));
  const originalTitle = run('state.detailCase.title');
  run('openCase("missing-id")');
  assert.equal(run('state.detailCase.title'), originalTitle, 'unknown ids do not silently open the first case');
  assert.ok(toast.textContent.includes('案例不存在'));
});
