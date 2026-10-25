import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { cases } = require('../miniprogram/data/cases');
const model = require('../miniprogram/utils/asset-map');
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('all 100 cases and 700 stage cards preserve identity, real assets and source data', () => {
  let count = 0;
  for (const item of cases) {
    const before = JSON.stringify(item);
    const map = model.buildCaseMap(item.title, item.businessNodes);
    assert.equal(map.root.title, item.title);
    assert.equal(map.branches.length, 7);
    assert.deepEqual(map.branches.map(branch => branch.id), item.businessNodes.map(node => node.id));
    item.businessNodes.forEach((node, index) => {
      const details = model.buildNodeMap(node);
      assert.equal(map.branches[index].summary, node.assetCard.goal);
      assert.equal(details.root.id, node.id);
      assert.equal(details.branches.find(branch => branch.id === 'method').summary, node.assetCard.how);
      for (const [key, values] of Object.entries(node.assetCard.assets)) {
        const actual = details.branches.find(branch => branch.id === `assets-${key}`);
        const expected = [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
        if (expected.length) assert.deepEqual(actual.items, expected);
        else assert.equal(actual, undefined);
      }
      assert.equal(details.branches.find(branch => branch.id === 'risk').summary, node.assetCard.riskNote || node.assetCard.risk);
      assert.ok(details.branches.every(branch => /^#[\da-f]{6}$/i.test(branch.color)));
      count++;
    });
    assert.equal(JSON.stringify(item), before, 'diagram construction cannot mutate the canonical case');
  }
  assert.equal(count, 700);
});

test('empty fields are omitted, text retained and style values constrained', () => {
  assert.equal(model.buildNodeMap(null), null);
  assert.equal(model.buildCaseMap('', null).branches.length, 0);
  const input = { id: 'one', name: '<img onerror=x>', color: 'red;background:url(x)', assetCard: { assets: { content: [' A ', '', 'A', '<b>B</b>'] } } };
  const map = model.buildNodeMap(input);
  assert.equal(map.root.title, input.name, 'renderers must escape text, not silently discard it');
  assert.equal(map.root.color, '#d9bb72');
  assert.deepEqual(map.branches.map(branch => branch.id), ['assets-content']);
  assert.deepEqual(map.branches[0].items, ['A', '<b>B</b>']);
});

test('unknown case costs and risks never turn into a zero-cost or zero-risk claim', () => {
  const map = model.buildNodeMap({ id: 'legacy', name: '案例节点', cost: 0, risk: 0, costStatus: 'not_individually_estimated', riskStatus: 'not_individually_estimated', costLabel: '整案成本待核算' });
  assert.match(map.branches.find(branch => branch.id === 'cost').summary, /未单独核算/);
  assert.ok(!map.branches.some(branch => branch.title === '模板成本示例' || branch.title === '模板风险示例'));
});

test('browser and native use exactly the same asset map model', () => {
  const context = vm.createContext({});
  vm.runInContext(read('miniprogram/utils/asset-map.js'), context);
  const native = model.buildNodeMap(cases[0].businessNodes[0]);
  const browser = context.QingchuangAssetMap.buildNodeMap(cases[0].businessNodes[0]);
  assert.equal(JSON.stringify(browser), JSON.stringify(native));
});

function component(path, dependencies = {}) {
  let result;
  const filename = new URL(`../${path}`, import.meta.url);
  const localRequire = createRequire(filename);
  vm.runInNewContext(read(path), { require: id => Object.hasOwn(dependencies, id) ? dependencies[id] : localRequire(id), Component(value) { result = value; }, wx: dependencies.wx });
  return result;
}

test('only interactive, existing stage branches can emit a selection', () => {
  const specification = component('miniprogram/components/asset-map/asset-map.js');
  const events = [];
  const scene = { ...specification.methods, data: { interactive: true, map: model.buildCaseMap(cases[0].title, cases[0].businessNodes) }, triggerEvent: (name, payload) => events.push({ name, id: payload.id }) };
  const id = cases[0].businessNodes[0].id;
  scene.selectBranch({ currentTarget: { dataset: { id } } });
  assert.deepEqual(events, [{ name: 'select', id }]);
  scene.selectBranch({ currentTarget: { dataset: { id: 'missing' } } });
  scene.data.interactive = false;
  scene.selectBranch({ currentTarget: { dataset: { id } } });
  assert.equal(events.length, 1);
});

test('sheet follows node changes and never reports success after failed storage', () => {
  let fail = true;
  const toasts = [];
  const events = [];
  const specification = component('miniprogram/components/node-detail-sheet/node-detail-sheet.js', {
    '../../utils/storage': { appendUnique(key, value) { assert.equal(key, 'savedStages'); if (fail) throw Error('quota'); return [value]; } },
    wx: { showToast: value => toasts.push(value) }
  });
  const scene = { ...specification.methods, data: { node: cases[0].businessNodes[0] }, setData(update) { Object.assign(this.data, update); }, triggerEvent: name => events.push(name) };
  specification.observers.node.call(scene, scene.data.node);
  assert.equal(scene.data.detailMap.root.id, scene.data.node.id);
  scene.saveStage();
  assert.equal(events.length, 0);
  assert.ok(toasts.every(value => value.icon !== 'success'));
  fail = false;
  scene.saveStage();
  assert.deepEqual(events, ['save']);
  assert.equal(toasts.at(-1).icon, 'success');
  specification.observers.node.call(scene, null);
  assert.equal(scene.data.detailMap, null);
});

test('native case detail registers a shared, scroll-aligned map and keeps the reading overlay', () => {
  const config = JSON.parse(read('miniprogram/pages/case-detail/case-detail.json'));
  assert.equal(config.usingComponents['asset-map'], '/components/asset-map/asset-map');
  const template = read('miniprogram/pages/case-detail/case-detail.wxml');
  assert.match(template, /<asset-map[^>]*bindselect="selectNodeFromIndex"/);
  assert.match(template, /covered="{{!!selectedNode}}"/);
  const style = read('miniprogram/components/asset-map/asset-map.wxss');
  assert.match(style, /\.map-branch::before/);
  assert.match(style, /\.map-branch::after/);
  assert.doesNotMatch(style, /position:\s*fixed/);
  assert.doesNotMatch(read('miniprogram/components/asset-map/asset-map.wxml'), /<canvas/);
});

test('native case-map clicks select the same original stage and unknown links do not switch cards', () => {
  let page;
  const path = 'miniprogram/pages/case-detail/case-detail.js';
  const localRequire = createRequire(new URL(`../${path}`, import.meta.url));
  vm.runInNewContext(read(path), {
    require: id => id.endsWith('/storage') ? { read: (_key, fallback) => fallback } : localRequire(id),
    getApp: () => ({ globalData: { reducedMotion: false } }),
    Page(value) { page = value; }
  });
  page.setData = update => Object.assign(page.data, update);
  page.onLoad({ id: cases[0].id });
  const id = page.data.assetMap.branches[3].id;
  page.selectNodeFromIndex({ detail: { id } });
  assert.equal(page.data.selectedNode.id, id);
  assert.ok(page.data.selectedNode.assetCard);
  page.selectNodeFromIndex({ detail: { id: 'missing' } });
  assert.equal(page.data.selectedNode.id, id);
  page.closeNode();
  assert.equal(page.data.selectedNode, null);
});
