import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import * as webThree from 'three';

const require = createRequire(import.meta.url);
const dna = require('../miniprogram/utils/dna-renderer');
const { theme, stageForNode, buildDna, drawFallbackDna, rungColor, colorForThree } = dna;
const { modules } = require('../miniprogram/data/modules');
const { calculate } = require('../miniprogram/utils/scoring');
const { createScopedThreejs } = require('../miniprogram/node_modules/threejs-miniprogram');
const miniThree = createScopedThreejs({ width: 360, height: 340, createImage() { return {}; } });
const expectedStages = ['coldStart', 'coldStart', 'validation', 'validation', 'monetization', 'monetization', 'operations', 'operations', 'operations', 'compliance'];
const byRole = (visual, role) => visual.group.children.filter(item => item.userData.role === role);
const saturation = color => new webThree.Color(color).getHSL({}).s;

test('native renderer loads with JS-only local module resolution', () => {
  const cache = new Map();
  function load(url) {
    if (cache.has(url.href)) return cache.get(url.href).exports;
    const module = { exports: {} };
    cache.set(url.href, module);
    vm.runInNewContext(readFileSync(url, 'utf8'), {
      module,
      exports: module.exports,
      require(id) {
        assert.ok(id.startsWith('.'), 'palette dependencies must stay local');
        assert.ok(!id.endsWith('.json'), 'WeChat does not load JSON through require');
        return load(new URL(id.endsWith('.js') ? id : `${id}.js`, url));
      }
    }, { filename: url.pathname });
    return module.exports;
  }
  const loaded = load(new URL('../miniprogram/utils/dna-renderer.js', import.meta.url));
  assert.equal(JSON.stringify(loaded.theme), JSON.stringify(theme));
  assert.equal(loaded.stageForNode({ id: 'traffic' }).id, 'coldStart');
});

test('browser bridge exposes the exact same palette without Node globals', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../miniprogram/config/dna-theme.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../miniprogram/utils/dna-renderer.js', import.meta.url), 'utf8'), context);
  const loaded = context.QingchuangDnaRenderer(context.QingchuangDnaTheme);
  assert.equal(JSON.stringify(loaded.theme), JSON.stringify(theme));
});

test('one five-stage palette with muted independent chain colors', () => {
  assert.deepEqual(Object.values(theme.stages).map(stage => stage.color), ['#FFF3DA', '#9BD5F3', '#A8E5C5', '#F4EAA1', '#D0BCEE']);
  for (const chain of Object.values(theme.chains)) {
    for (const stage of Object.values(theme.stages)) assert.ok(saturation(chain.color) < saturation(stage.color));
  }
  for (const stage of Object.values(theme.stages)) {
    assert.ok(saturation(rungColor(stage.color)) < saturation(stage.color));
  }
  assert.ok(theme.rung.opacity < theme.skeleton.opacity);
  assert.ok(theme.leader.opacity < 1);
});

test('stages depend on node identity, never order or old business color', () => {
  assert.deepEqual(modules.map(node => stageForNode(node).id), expectedStages);
  const reversed = [...modules].reverse().map(node => stageForNode(node).id).reverse();
  assert.deepEqual(reversed, expectedStages);
  assert.equal(stageForNode({ id: 'unknown' }).id, 'validation');
  assert.equal(stageForNode({ id: 'traffic', stage: 'compliance' }).id, 'compliance');
  assert.equal(stageForNode({ id: 'custom', type: 'transaction' }).id, 'monetization');
});

for (const [label, THREE] of [['web', webThree], ['mini r108', miniThree]]) {
  test(`${label}: all nodes have two clickable, equally colored stage bubbles`, () => {
    const original = JSON.stringify(modules);
    const score = calculate(modules);
    const visual = buildDna(THREE, modules);
    assert.equal(visual.clickable.length, modules.length * 2);
    visual.clickable.forEach((sphere, index) => {
      const nodeIndex = Math.floor(index / 2);
      const side = index % 2 ? 'B' : 'A';
      assert.equal(sphere.userData.side, side);
      assert.equal(sphere.userData.stage, expectedStages[nodeIndex]);
      assert.ok(sphere.material.color.equals(colorForThree(THREE, theme.stages[expectedStages[nodeIndex]].color)));
      assert.equal(sphere.material.type, 'MeshPhongMaterial');
      assert.equal(sphere.material.opacity, 1);
      assert.ok(sphere.position.distanceTo(visual.pointAt(nodeIndex / (modules.length - 1), side)) < 1e-8);
      assert.equal(sphere.userData.node.chain, modules[nodeIndex].chain);
    });
    assert.equal(JSON.stringify(modules), original);
    assert.deepEqual(calculate(modules), score);
    const skeletons = byRole(visual, 'skeleton');
    assert.equal(skeletons.length, 2);
    skeletons.forEach(mesh => assert.ok(mesh.material.color.equals(colorForThree(THREE, theme.chains[mesh.userData.side].color))));
    byRole(visual, 'rung').forEach((rung, index) => {
      assert.ok(rung.material.color.equals(colorForThree(THREE, rungColor(stageForNode(modules[index]).color))));
      assert.equal(rung.material.opacity, theme.rung.opacity);
      assert.equal(rung.material.depthWrite, false);
    });
  });

  test(`${label}: selection on either side reveals only its matching-color leader`, () => {
    const visual = buildDna(THREE, modules);
    for (const node of modules) {
      for (const side of ['A', 'B']) {
        visual.select(node.id, side);
        const visible = byRole(visual, 'leader').filter(line => line.visible);
        assert.equal(visible.length, 1);
        assert.equal(visible[0].userData.side, side);
        assert.equal(visible[0].userData.nodeId, node.id);
        assert.ok(visible[0].material.color.equals(colorForThree(THREE, stageForNode(node).color)));
        assert.equal(visible[0].material.opacity, theme.leader.opacity);
        const selected = visual.clickable.filter(sphere => sphere.scale.x > 1);
        assert.equal(selected.length, 1);
        assert.equal(selected[0].scale.x, theme.bubble.selectedScale);
      }
    }
    visual.select('');
    assert.equal(byRole(visual, 'leader').filter(line => line.visible).length, 0);
    assert.ok(visual.clickable.every(sphere => sphere.scale.x === 1));
  });

  test(`${label}: empty, single, odd and long DNA remain finite and centered`, () => {
    for (const count of [0, 1, 3, 10, 24]) {
      const nodes = Array.from({ length: count }, (_, index) => ({ ...modules[index % 10], id: `n${index}`, type: modules[index % 10].id }));
      const visual = buildDna(THREE, nodes);
      assert.equal(visual.clickable.length, count * 2);
      assert.equal(byRole(visual, 'skeleton').length, count > 1 ? 2 : 0);
      assert.equal(visual.height, Math.max(0, count - 1) * theme.geometry.rowSpacing);
      visual.clickable.forEach(sphere => assert.ok(sphere.position.toArray().every(Number.isFinite)));
    }
  });
}

function canvasContext() {
  const strokes = [];
  return {
    strokes, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, fill() {}, clearRect() {},
    stroke() { strokes.push({ color: this.strokeStyle, opacity: this.globalAlpha }); },
    createRadialGradient() { return { addColorStop() {} }; }
  };
}

test('2D fallback keeps the same colors, paired hits and selected leader', () => {
  const ctx = canvasContext();
  const points = drawFallbackDna(ctx, 360, 340, modules, 'traffic', 'B');
  assert.equal(points.length, modules.length * 2);
  assert.equal(points[3].side, 'B');
  assert.equal(points[3].item.color, theme.stages.coldStart.color);
  assert.ok(points.every(point => point.x > 0 && point.x < 360 && point.y > 0 && point.y < 340));
  const leaders = ctx.strokes.filter(stroke => stroke.opacity === theme.leader.opacity);
  assert.deepEqual(leaders, [{ color: theme.stages.coldStart.color, opacity: theme.leader.opacity }]);
});

test('native component refreshes selection and fallback data without stale highlights', () => {
  let specification;
  const source = readFileSync(new URL('../miniprogram/components/space-scene/space-scene.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    Component(value) { specification = value; },
    require(id) { return id.includes('dna-renderer') ? dna : { createScopedThreejs }; }
  });
  const ctx = canvasContext();
  const component = { ...specification.methods, data: { mode: 'dna', items: modules, selectedId: 'traffic' }, width: 360, height: 340, fallbackCtx: ctx, readyOnce: true };
  specification.observers.selectedId.call(component, 'traffic');
  assert.equal(component.fallbackPoints.length, 20);
  ctx.strokes.length = 0;
  component.applyDnaSelection('');
  assert.equal(ctx.strokes.filter(stroke => stroke.opacity === theme.leader.opacity).length, 0);
  component.data.items = modules.slice(0, 2);
  specification.observers['mode,items'].call(component);
  assert.equal(component.fallbackPoints.length, 4);
  let selected;
  component.triggerEvent = (_, detail) => { selected = detail; };
  const point = component.fallbackPoints[1];
  component.onFallbackTap({ changedTouches: [{ x: point.x, y: point.y }] });
  assert.equal(selected.node.visualChain, 'B');
  assert.equal(component.dnaSelectedSide, 'B');
});
