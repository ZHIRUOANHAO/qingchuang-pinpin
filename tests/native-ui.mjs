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
  const sceneMarkup = read('components/space-scene/space-scene.wxml');
  assert.match(read('pages/home/home.wxml'), /<space-scene mode="universe"/);
  assert.match(read('components/dna-view/dna-view.wxml'), /<space-scene[^>]*mode="dna"/);
  assert.equal((sceneMarkup.match(/disable-scroll="{{mode !== 'dna'}}"/g) || []).length, 2);
  assert.match(sceneMarkup, /bindtouchmove="onTouchMove"/);
  assert.doesNotMatch(sceneMarkup, /catchtouchmove=/);
  assert.match(read('components/space-scene/space-scene.js'), /utils\/orbit/);
  assert.match(read('components/space-scene/space-scene.js'), /updateUniverse/);
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

test('native case pages show source verification without calling the cases unverified', () => {
  const pages = [
    'pages/home/home.wxml',
    'pages/cases/cases.wxml',
    'pages/case-detail/case-detail.wxml',
    'pages/ai/ai.wxml',
    'pages/membership/membership.wxml',
    'pages/minors/minors.wxml',
    'components/dna-view/dna-view.wxml',
  ];
  for (const path of pages) assert.doesNotMatch(read(path), /未验证|待验证/, `${path}: source-checked cases should not be labeled unverified`);
  assert.match(read('pages/cases/cases.wxml'), /\{\{item\.sourceStatusLabel\}\} · \{\{item\.evidenceCheckedOn\}\}/);
  assert.match(read('pages/case-detail/case-detail.wxml'), /item\.proofSources/);
  assert.match(read('pages/case-detail/case-detail.wxml'), /复制原始链接/);
  assert.match(read('pages/ai/ai.wxml'), /\{\{result\.sourceStatusLabel\}\} · \{\{result\.evidenceCheckedOn\}\}/);
  assert.match(read('components/dna-view/dna-view.wxml'), /不设评分/);
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

test('case library keeps text in bounds and decorative DNA inside scrolling cards', () => {
  const markup = read('pages/cases/cases.wxml');
  const style = read('pages/cases/cases.wxss');
  const miniMarkup = read('components/dna-mini/dna-mini.wxml');
  const mini = component('components/dna-mini/dna-mini.js');
  assert.match(style, /\.cases-page\s*\{[^}]*padding:\s*0 24rpx/s);
  assert.match(style, /\.cases-page \.brand-block text\s*\{\s*display:\s*block/);
  assert.match(style, /\.case-item\s*\{[^}]*width:\s*100%/s);
  assert.match(markup, /<view class="access-filters"><text class="access-note">[^<]*<\/text><button/);
  assert.doesNotMatch(miniMarkup, /<canvas\b/);
  assert.match(miniMarkup, /wx:for="{{rungs}}"/);
  assert.equal(mini.data.rungs.length, 10);
  assert.ok(mini.data.rungs.every(rung => Number.isFinite(rung.first) && Number.isFinite(rung.second)));
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
    assert.match(read(`${page}.wxml`), /<safe-top(?:\s[^>]*)?>/, page);
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

test('DNA vertical drag yields to page scroll while horizontal drag rotates the model', () => {
  const specification = component('components/space-scene/space-scene.js');
  const scene = { ...specification.methods, data: { mode: 'dna' }, root: { rotation: { x: 0, y: 0 } } };
  scene.onTouchStart({ touches: [{ x: 20, y: 20 }] });
  scene.onTouchMove({ touches: [{ x: 21, y: 50 }] });
  scene.onTouchMove({ touches: [{ x: 50, y: 50 }] });
  assert.equal(scene.gestureAxis, 'y');
  assert.deepEqual(scene.root.rotation, { x: 0, y: 0 });
  scene.onTouchCancel();
  assert.equal(scene.gestureAxis, null);
  scene.onTouchStart({ touches: [{ x: 20, y: 20 }] });
  scene.onTouchMove({ touches: [{ x: 50, y: 21 }] });
  assert.equal(scene.gestureAxis, 'x');
  assert.ok(scene.root.rotation.y > 0);
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

test('universe planets orbit on orderly, deterministic and bounded rings', () => {
  const orbit = require('../miniprogram/utils/orbit.js');
  const orbiters = orbit.createOrbiters(100);
  assert.equal(orbiters.length, 100);
  assert.equal(new Set(orbiters.map(orbiter => orbiter.band)).size, 5);
  assert.equal(orbit.BAND_COUNT, 5);
  const repeats = orbit.createOrbiters(100);
  assert.deepEqual(repeats[37], orbiters[37], 'orbit parameters are deterministic');

  // 同一轨道共速：20 颗星球等角距排布，队形不会随时间散开。
  const step = orbit.TAU / orbit.PLANETS_PER_BAND;
  const speeds = [];
  for (let band = 0; band < orbit.BAND_COUNT; band += 1) {
    const ring = orbiters.filter(orbiter => orbiter.band === band);
    assert.equal(ring.length, orbit.PLANETS_PER_BAND, 'each ring carries an equal share of planets');
    assert.equal(new Set(ring.map(orbiter => orbiter.speed.toFixed(6))).size, 1, 'one shared speed per ring');
    const phases = ring.map(orbiter => orbiter.phase).sort((a, b) => a - b);
    phases.forEach((phase, index) => {
      if (index === 0) return;
      assert.ok(Math.abs((phase - phases[index - 1]) - step) < 1e-9, 'planets stay evenly spaced on their ring');
    });
    speeds.push(ring[0].speed);
  }
  assert.ok(speeds.every(speed => speed > 0), 'all rings revolve in the same direction');
  assert.ok(speeds[0] > speeds[orbit.BAND_COUNT - 1], 'the inner ring revolves faster than the outer ring');
  assert.equal(orbit.SYSTEM_TILT.length, 2, 'the whole system shares one tilted orbital plane');

  const start = orbiters.map(orbiter => orbit.positionAt(orbiter, 0));
  const later = orbiters.map(orbiter => orbit.positionAt(orbiter, 18));
  assert.ok(start.every(position => Math.abs(position.y) < .15), 'orbits stay a thin, nearly coplanar disc');
  assert.ok(orbiters.every(orbiter => orbiter.eccentricity > 0 && orbiter.eccentricity < .07), 'each planet has a small natural eccentricity');
  assert.ok(orbiters.every(orbiter => Math.abs(orbiter.inclination) < .03), 'orbital inclinations stay tiny and natural');
  assert.ok(new Set(orbiters.map(orbiter => orbiter.periapsis.toFixed(4))).size > 90, 'periapsis directions are varied like natural orbits');
  const travelled = later.filter((position, index) => Math.hypot(
    position.x - start[index].x, position.y - start[index].y, position.z - start[index].z
  ) > .05).length;
  assert.ok(travelled > 95, 'almost every planet actually travels on its ring');

  const furthest = later.reduce((radius, position) => Math.max(radius, Math.hypot(position.x, position.y, position.z)), 0);
  assert.ok(furthest < 4.6, 'orbit radii stay inside the framed universe (' + furthest.toFixed(3) + ')');
  const reference = orbit.positionAt(orbiters[0], 7);
  assert.deepEqual(orbit.positionAt(orbiters[0], 7), reference, 'positionAt is a pure function of time');
});
