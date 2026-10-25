// Deterministic trajectory and native animation-lifecycle checks.
// This VM test does not replace compilation or testing in WeChat on a real device.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const orbit = require('../miniprogram/utils/orbit');
const filename = new URL('../miniprogram/components/space-scene/space-scene.js', import.meta.url);
const source = readFileSync(filename, 'utf8');

function backdrop() {
  let specification;
  const path = new URL('../miniprogram/components/galaxy-backdrop/galaxy-backdrop.js', import.meta.url);
  vm.runInNewContext(readFileSync(path, 'utf8'), { Component(value) { specification = value; } });
  const frames = new Map();
  let nextFrame = 0;
  const ctx = { clearRect() {}, createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  const canvas = { requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; }, cancelAnimationFrame(id) { frames.delete(id); } };
  const scene = { ...specification.methods, canvas, ctx, stars: [], width: 360, height: 240, startAt: Date.now() };
  return { scene, frames, specification };
}

test('shared star backdrop cancels even frame zero on hide and detach', () => {
  const { scene, frames, specification } = backdrop();
  scene.drawFrame();
  assert.equal(scene.frame, 0);
  specification.pageLifetimes.hide.call(scene);
  assert.equal(frames.size, 0);
  scene.drawFrame();
  assert.equal(frames.size, 0, 'a hidden backdrop cannot schedule itself again');
  specification.pageLifetimes.show.call(scene);
  assert.equal(frames.size, 1);
  specification.lifetimes.detached.call(scene);
  assert.equal(frames.size, 0);
  assert.equal(scene.canvas, null);
  assert.doesNotThrow(() => scene.drawFrame());
});

test('shared star backdrop draws a single static frame for reduced motion', () => {
  const { scene, frames } = backdrop();
  scene.reducedMotion = true;
  scene.drawFrame();
  assert.equal(frames.size, 0);
});

test('a late canvas initialization cannot revive a detached backdrop', () => {
  const { scene, specification } = backdrop();
  let complete;
  const query = { select() { return query; }, fields() { return query; }, exec(callback) { complete = callback; } };
  scene.createSelectorQuery = () => query;
  scene.draw();
  specification.lifetimes.detached.call(scene);
  assert.doesNotThrow(() => complete([{ node: { getContext() { throw Error('should not initialize'); } } }]));
  assert.equal(scene.canvas, null);
});

function harness({ fallback = false, mode = 'universe' } = {}) {
  let now = 10000;
  let nextFrame = 0;
  let specification;
  let renders = 0;
  const frames = new Map();
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(source, {
    require: createRequire(filename), Date: Clock,
    Component(value) { specification = value; }
  });
  const canvas = {
    requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    toDataURL() { return 'data:image/png;base64,frame'; }
  };
  const scene = {
    ...specification.methods,
    data: { mode, items: [], paused: false, covered: false, reducedMotion: false, selectedId: '' },
    running: true, orbitTime: 0, fallbackTime: 0,
    root: { rotation: { x: 0, y: 0 } }, scene: {}, camera: {},
    setData(update, callback) { Object.assign(this.data, update); callback?.(); },
    updateUniverse(time) { this.lastUniverseTime = time; },
    drawFallback() { renders++; }
  };
  if (fallback) { scene.fallbackCanvas = canvas; scene.fallbackCtx = {}; }
  else { scene.canvas = canvas; scene.glRenderer = { render() { renders++; } }; }
  const tick = milliseconds => {
    now += milliseconds;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(now));
  };
  const advance = (milliseconds, fps = 60) => {
    const steps = Math.max(1, Math.round(milliseconds * fps / 1000));
    for (let index = 0; index < steps; index++) tick(milliseconds / steps);
  };
  const updateMotion = update => {
    Object.assign(scene.data, update);
    specification.observers['paused,reducedMotion'].call(scene);
  };
  const start = () => fallback ? scene.startFallbackAnimation() : scene.animate();
  return { scene, tick, advance, start, updateMotion, specification,
    pending: () => frames.size, renders: () => renders, now: () => now };
}

test('five natural orbit bands preserve visible spacing and never overlap planets', () => {
  const planets = orbit.createOrbiters(100);
  assert.equal(planets.length, 100);
  assert.equal(orbit.BAND_COUNT, 5);
  assert.deepEqual(orbit.createOrbiters(100), planets, 'rebuilding preserves the same constellation');
  const normalize = angle => (angle % orbit.TAU + orbit.TAU) % orbit.TAU;
  const speeds = [];
  for (let band = 0; band < orbit.BAND_COUNT; band++) {
    const ring = planets.filter(planet => planet.band === band);
    assert.equal(ring.length, 20);
    assert.equal(new Set(ring.map(planet => planet.speed)).size, 1);
    speeds.push(ring[0].speed);
    for (const time of [0, 1, 30, 120, 7200]) {
      const positions = ring.map(planet => orbit.positionAt(planet, time));
      positions.forEach((point, index) => {
        const radius = Math.hypot(point.x, point.y, point.z);
        assert.ok(Math.abs(point.y) <= ring[index].radius * 1.025 * Math.sin(.025) + 1e-8);
        assert.ok(radius >= ring[index].radius * .975 - 1e-8 && radius <= ring[index].radius * 1.025 + 1e-8);
      });
      const angles = positions.map(point => normalize(Math.atan2(point.z, point.x))).sort((a, b) => a - b);
      angles.forEach((angle, index) => {
        const gap = normalize(angles[(index + 1) % angles.length] - angle);
        assert.ok(Math.abs(gap - orbit.TAU / 20) < .001, `band ${band}, time ${time}: spacing remains close to 18 degrees`);
      });
    }
  }
  assert.ok(speeds.every(speed => speed > 0));
  assert.ok(speeds.every((speed, index) => !index || speed < speeds[index - 1]), 'outer bands move more slowly');
  assert.ok(planets.every(planet => planet.radius < 4.3));
  for (const time of [0, 1, 30, 120, 7200]) {
    const positions = planets.map(planet => orbit.positionAt(planet, time));
    for (let left = 0; left < planets.length; left++) for (let right = left + 1; right < planets.length; right++) {
      const a = positions[left]; const b = positions[right];
      const separation = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      assert.ok(separation > orbit.planetSize(planets[left].band, left) + orbit.planetSize(planets[right].band, right), `planets ${left}/${right} overlap at ${time}s`);
    }
  }
});

test('trajectories are continuous, stateless and shared between CommonJS and browser exports', () => {
  const script = readFileSync(new URL('../miniprogram/utils/orbit.js', import.meta.url), 'utf8');
  const browser = {};
  vm.runInNewContext(script, browser);
  const planets = orbit.createOrbiters(100);
  for (const planet of planets) {
    const time = 7.25;
    const point = orbit.positionAt(planet, time);
    const next = orbit.positionAt(planet, time + .0001);
    assert.ok(Math.hypot(next.x - point.x, next.y - point.y, next.z - point.z) < .0001);
    orbit.positionAt(planet, time + 1000);
    assert.deepEqual(orbit.positionAt(planet, time), point, 'no hidden cumulative position state');
    const browserPoint = browser.QingchuangOrbit.positionAt(planet, time);
    assert.deepEqual([browserPoint.x, browserPoint.y, browserPoint.z], [point.x, point.y, point.z]);
    const out = {};
    assert.equal(orbit.positionAt(planet, time, out), out, 'rendering may reuse a vector without allocating each frame');
    assert.deepEqual(out, point);
  }
});

test('universe travel is time based at 30, 60 and 120 Hz without rotating the whole composition', () => {
  const travel = [30, 60, 120].map(fps => {
    const h = harness(); h.start(); h.tick(0); h.advance(1000, fps);
    assert.equal(h.scene.root.rotation.y, 0, 'only the planet and orbiters rotate automatically');
    assert.equal(h.pending(), 1);
    assert.equal(h.scene.lastUniverseTime, h.scene.orbitTime);
    return h.scene.orbitTime;
  });
  travel.forEach(value => assert.ok(Math.abs(value - 1) < 1e-9));
});

for (const fallback of [false, true]) {
  const label = fallback ? '2D fallback' : 'WebGL';
  test(`${label} pause and reduced motion stop RAF work and resume from the same position`, () => {
    const h = harness({ fallback }); h.start(); h.tick(0); h.advance(200);
    const clock = () => fallback ? h.scene.fallbackTime : h.scene.orbitTime;
    const before = clock();
    h.updateMotion({ paused: true });
    assert.equal(h.pending(), 0, 'paused scene does not keep scheduling idle frames');
    h.advance(5000);
    assert.equal(clock(), before);
    h.updateMotion({ paused: false });
    assert.equal(h.pending(), 1);
    h.tick(16);
    assert.ok(clock() - before < .02, 'resuming does not catch up all hidden wall time');
    h.updateMotion({ reducedMotion: true });
    assert.equal(h.pending(), 0);
    const staticTime = clock(); h.advance(1000); assert.equal(clock(), staticTime);
    h.updateMotion({ reducedMotion: false }); assert.equal(h.pending(), 1);
  });

  test(`${label} page hide, repeated show and reading overlays never create multiple animation loops`, () => {
    const h = harness({ fallback }); h.start();
    h.specification.pageLifetimes.hide.call(h.scene);
    assert.equal(h.pending(), 0, 'hiding also cancels an implementation that returns RAF id zero');
    h.specification.pageLifetimes.show.call(h.scene);
    h.tick(0); h.advance(150);
    h.specification.pageLifetimes.hide.call(h.scene);
    assert.equal(h.pending(), 0, 'hiding cancels the active frame');
    const before = fallback ? h.scene.fallbackTime : h.scene.orbitTime;
    h.advance(10000);
    h.specification.pageLifetimes.show.call(h.scene);
    h.specification.pageLifetimes.show.call(h.scene);
    assert.equal(h.pending(), 1, 'repeated show cannot double-schedule');
    h.tick(16);
    const after = fallback ? h.scene.fallbackTime : h.scene.orbitTime;
    assert.ok(after - before < .02, 'page show does not jump forward');
    h.scene.data.covered = true; h.scene.updateCovered(true);
    assert.equal(h.pending(), 0);
    h.scene.data.covered = false; h.scene.updateCovered(false);
    assert.equal(h.pending(), 1);
    h.scene.refreshMotion(); h.scene.refreshMotion(); assert.equal(h.pending(), 1);
  });
}

test('dragging freezes flight, and release holds 0.8 seconds before a smooth restart', () => {
  const h = harness(); h.start(); h.tick(0); h.advance(150);
  const before = h.scene.orbitTime;
  h.scene.onTouchStart({ touches: [{ x: 10, y: 10 }] });
  assert.equal(h.pending(), 0);
  h.advance(1000); assert.equal(h.scene.orbitTime, before);
  h.scene.onTouchMove({ touches: [{ x: 50, y: 20 }] });
  assert.ok(h.scene.root.rotation.y > 0, 'manual drag still rotates the view');
  h.scene.onTouchCancel();
  h.advance(700); assert.equal(h.scene.orbitTime, before);
  h.advance(100); assert.ok(h.scene.orbitTime - before < .01);
  h.advance(200);
  assert.ok(h.scene.orbitTime > before);
  assert.ok(h.scene.motionSpeed > 0 && h.scene.motionSpeed < 1);
});

test('restart easing integrates identically at different refresh rates', () => {
  const travel = [30, 60, 120].map(fps => {
    const h = harness(); h.scene.motionSpeed = 0; h.scene.resumeAt = 0;
    h.start(); h.tick(0); h.advance(1000, fps);
    return h.scene.orbitTime;
  });
  assert.ok(Math.max(...travel) - Math.min(...travel) < 1e-9);
  assert.ok(travel[0] > .8 && travel[0] < 1);
});
