import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { customTopInset } = require('../miniprogram/utils/layout');
const root = new URL('../miniprogram/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
test('home bounds the planet within one viewport and prevents page scrolling', () => {
  const config = JSON.parse(read('pages/home/home.json'));
  assert.equal(config.disableScroll, true);
  assert.equal(config.enablePullDownRefresh, false);
  assert.doesNotMatch(read('pages/home/home.wxml'), /<scroll-view/);
  assert.match(read('pages/home/home.wxss'), /height:100vh/);
  assert.match(read('components/space-scene/space-scene.wxml'), /catchtouchmove="onTouchMove"/);
  assert.doesNotMatch(read('components/space-scene/space-scene.js'), /baseY \+ Math.sin/);
});

test('release navigation has no login, membership, order or payment surface', () => {
  const app = JSON.parse(read('app.json'));
  for (const route of ['pages/login/login', 'pages/account/account', 'pages/membership/membership', 'pages/orders/orders']) assert.ok(!app.pages.includes(route));
  assert.equal(app.tabBar.list.find(item => item.pagePath === 'pages/ai/ai').text, '案例演示');
  const profile = `${read('pages/profile/profile.js')}\n${read('pages/profile/profile.wxml')}`;
  assert.doesNotMatch(profile, /services\/auth|services\/payment|pages\/(login|account|membership|orders)|购买会员|创建订单/);
  assert.match(profile, /无会员购买 · 无订单 · 无外部模型调用 · 广告未启用/);
});

test('case demo is predefined, local and upload-free', () => {
  const code = read('pages/ai/ai.js');
  const markup = read('pages/ai/ai.wxml');
  assert.doesNotMatch(code, /services\/ai|wx\.request|wx\.uploadFile|wx\.cloud|chooseMessageFile/);
  assert.doesNotMatch(markup, /<textarea|选择PDF|选择商业截图|DS V4 PRO/);
  assert.match(markup, /全部内容已预置在安装包内/);
  assert.match(markup, /不调用外部模型/);
  assert.match(markup, /载入案例 DNA/);
});

test('privacy, terms and minors notices match the local-only data flow', () => {
  const app = JSON.parse(read('app.json'));
  for (const route of ['pages/privacy/privacy', 'pages/agreement/agreement', 'pages/minors/minors']) assert.ok(app.pages.includes(route));
  assert.match(read('pages/privacy/privacy.wxml'), /当前版本无需登录/);
  assert.match(read('pages/privacy/privacy.wxml'), /清除本机记录/);
  assert.match(read('pages/agreement/agreement.wxml'), /不提供内容生成、交易撮合、投资顾问、付费会员、订单或支付服务/);
  assert.match(read('pages/minors/minors.wxml'), /不满十四周岁/);
});

test('plain trading explanations precede native DNA and include the payment endpoint', () => {
  const markup = read('pages/case-detail/case-detail.wxml');
  assert.ok(markup.indexOf('class="business-brief"') < markup.indexOf('<dna-view'));
  for (const field of ['offer', 'payer', 'purchaseReason', 'delivery', 'chargingModel', 'moneyFlow']) assert.ok(markup.includes(`{{item.${field}}}`));
  assert.match(markup, /从卖点到交付、收钱/);
});

test('native starter route clears stale search and paid filters', () => {
  let page;
  const values = new Map([['caseSearch', ''], ['caseAccess', 'starter']]);
  vm.runInNewContext(read('pages/cases/cases.js'), {
    require: id => id.endsWith('/cases') ? { availableTags: () => [] } : { getSlot: () => ({}) },
    Page: value => { page = value; },
    wx: { getStorageSync: key => values.get(key), removeStorageSync: key => values.delete(key) }
  });
  let fetched = false;
  page.data.keyword = 'stale'; page.data.access = 'paid';
  page.setData = (update, callback) => { Object.assign(page.data, update); callback?.(); };
  page.fetch = reset => { fetched = reset; };
  page.onShow();
  assert.equal(page.data.tag, '轻量试做'); assert.equal(page.data.access, 'all'); assert.equal(page.data.keyword, ''); assert.equal(fetched, true);
  assert.equal(values.has('caseAccess'), false);
});

test('old paid routes reopen the full library without payment or ad gates', () => {
  let page;
  const values = new Map([['caseAccess', 'paid']]);
  vm.runInNewContext(read('pages/cases/cases.js'), {
    require: id => id.endsWith('/cases') ? { availableTags: () => [] } : { getSlot: () => ({}) },
    Page: value => { page = value; }, wx: { getStorageSync: key => values.get(key), removeStorageSync: key => values.delete(key) }
  });
  page.setData = (update, callback) => { Object.assign(page.data, update); callback?.(); };
  page.fetch = () => {};
  page.onShow();
  assert.equal(page.data.access, 'all');
  assert.doesNotMatch(read('pages/cases/cases.wxml'), /selectAccess|付费简介/);
  assert.doesNotMatch(read('pages/case-detail/case-detail.wxml'), /item\.locked|openAccessNotice|付费内容/);
  const ads = require('../miniprogram/config/ads');
  assert.equal(ads.enabled, false);
  assert.ok(Object.keys(ads.slots).every(name => !ads.getSlot(name).enabled && !ads.getSlot(name).unitId));
});
function component(path) {
  let specification;
  const filename = new URL(path, root);
  vm.runInNewContext(read(path), { require: createRequire(filename), Component(value) { specification = value; } });
  return specification;
}

test('safe top reserves both system status and WeChat capsule areas', () => {
  assert.equal(customTopInset({ statusBarHeight: 47 }, { bottom: 87 }), 95);
  assert.equal(customTopInset({ statusBarHeight: 20 }, { bottom: 58 }), 66);
  assert.equal(customTopInset({ statusBarHeight: 0 }, { bottom: 32 }), 44);
  assert.equal(customTopInset(), 72);
  assert.equal(customTopInset({ statusBarHeight: -10 }, { bottom: 999 }), 48);
  assert.equal(customTopInset({ statusBarHeight: 47 }, { bottom: NaN }), 95);
});

test('every custom navigation page registers and renders safe-top', () => {
  const app = JSON.parse(read('app.json'));
  for (const page of app.pages) {
    const config = JSON.parse(read(`${page}.json`));
    if (config.navigationStyle !== 'custom') continue;
    assert.equal(config.usingComponents['safe-top'], '/components/safe-top/safe-top', page);
    assert.match(read(`${page}.wxml`), /<safe-top>/, page);
  }
});

test('native renderer ignores WeChat renderer metadata before initialization', () => {
  const specification = component('components/space-scene/space-scene.js');
  const scene = { ...specification.methods, data: {}, renderer: 'webview' };
  assert.doesNotThrow(() => specification.pageLifetimes.show.call(scene));
  assert.doesNotThrow(() => scene.onTouchMove({ touches: [{ x: 20, y: 20 }] }));
  scene.touching = true;
  scene.onTouchCancel();
  assert.equal(scene.touching, false);
  assert.equal(scene.pinchStart, null);
  assert.equal(scene.renderer, 'webview');
});

test('universe pinch gesture never ends as an accidental planet tap', () => {
  const specification = component('components/space-scene/space-scene.js');
  const picks = [];
  const scene = { ...specification.methods, data: {}, root: { rotation: { x: 0, y: 0 } }, zoomView() {}, pick: (...args) => picks.push(args) };
  scene.onTouchStart({ touches: [{ x: 20, y: 20 }, { x: 60, y: 20 }] });
  scene.onTouchMove({ touches: [{ x: 21, y: 20 }, { x: 70, y: 20 }] });
  scene.onTouchEnd({ touches: [{ x: 21, y: 20 }], changedTouches: [{ x: 70, y: 20 }] });
  scene.onTouchEnd({ touches: [], changedTouches: [{ x: 21, y: 20 }] });
  assert.deepEqual(picks, []);
  assert.equal(scene.pinching, false);
});

test('energy-saving canvas drag and cancellation never select a case', () => {
  const specification = component('components/space-scene/space-scene.js');
  const calls = [];
  const scene = { ...specification.methods, data: { mode: 'universe' }, fallbackPoints: [{ x: 5, y: 5, item: { id: 'real_001' } }], triggerEvent: (...args) => calls.push(args) };
  scene.onFallbackStart(); scene.onFallbackMove(); scene.onFallbackTap({ changedTouches: [{ x: 5, y: 5 }] });
  assert.equal(calls.length, 0);
  scene.onFallbackStart(); scene.onFallbackTap({ changedTouches: [{ x: 5, y: 5 }] });
  assert.equal(calls.length, 1);
});

test('DNA toolbar delegates zoom and reset and tolerates an empty canvas', () => {
  const specification = component('components/dna-view/dna-view.js');
  const calls = [];
  const view = { ...specification.methods, selectComponent: () => ({ resetView: () => calls.push('reset'), zoomView: amount => calls.push(amount) }), triggerEvent: (name, data) => calls.push([name, data]) };
  view.zoomIn(); view.zoomOut(); view.resetView(); view.selectNode({ detail: { id: 'traffic' } });
  assert.deepEqual(calls, [-.8, .8, 'reset', ['select', { id: 'traffic' }]]);
  view.selectComponent = () => null;
  assert.doesNotThrow(() => { view.resetView(); view.zoomIn(); view.zoomOut(); });
});

test('all DNA pages hide the native layer while showing node details', () => {
  for (const page of ['case-detail', 'canvas', 'ai']) {
    const template = read(`pages/${page}/${page}.wxml`);
    assert.match(template, /<dna-view[^>]*covered="{{!!selectedNode}}"/);
    assert.match(template, /selected-id="{{selectedNode \? selectedNode.id : ''}}"/);
    assert.match(template, /<node-detail-sheet/);
  }
  assert.match(read('components/space-scene/space-scene.wxml'), /hidden="{{covered}}"/);
  assert.match(read('components/space-scene/space-scene.wxml'), /class="snapshot"/);
});

test('snapshot failure still allows opening and closing the reading sheet', () => {
  const specification = component('components/space-scene/space-scene.js');
  const scene = { ...specification.methods, data: { selectedId: '', covered: true }, canvas: { toDataURL() { throw Error('unsupported'); } }, setData(update) { Object.assign(this.data, update); } };
  assert.doesNotThrow(() => scene.updateCovered(true));
  assert.equal(scene.data.snapshot, '');
  scene.data.covered = false;
  assert.doesNotThrow(() => scene.updateCovered(false));
});

test('case detail preserves source chain and derives colored node index', () => {
  const path = 'pages/case-detail/case-detail.js';
  let page;
  const localRequire = createRequire(new URL(path, root));
  vm.runInNewContext(read(path), { require: id => id.endsWith('/storage') ? { read: (key, fallback) => fallback } : localRequire(id), getApp: () => ({ globalData: { reducedMotion: false } }), Page: value => { page = value; } });
  page.setData = update => Object.assign(page.data, update);
  page.onLoad({ id: 'real_001' });
  assert.equal(page.data.chainSteps.map(step => step.title).join(' → '), '卖点定位 → 引流获客 → 种草教育 → 转化成交 → 收款 → 产品交付 → 复购裂变');
  assert.equal(page.data.nodeIndex.length, page.data.item.businessNodes.length);
  assert.ok(page.data.nodeIndex.every(node => node.assetCard?.goal && node.assetCard?.how && node.assetCard?.risk));
  const target = page.data.nodeIndex[1];
  page.selectNodeFromIndex({ currentTarget: { dataset: { id: target.id } } });
  assert.equal(page.data.selectedNode.id, target.id);
  assert.match(page.data.selectedNode.color, /^#[0-9A-F]{6}$/);
  page.closeNode();
  assert.equal(page.data.selectedNode, null);
  for (let number = 21; number <= 100; number += 1) {
    page.onLoad({ id: `real_${String(number).padStart(3, '0')}` });
    assert.equal(page.data.nodeIndex.length, 7, `former paid case ${number} has all seven stages`);
    assert.equal(page.data.item.locked, false);
    assert.ok(page.data.item.delivery && page.data.item.moneyFlow);
  }
  page.onLoad({ id: 'unknown-id' });
  assert.equal(page.data.item, null, 'an unknown case does not masquerade as a different case');
});
