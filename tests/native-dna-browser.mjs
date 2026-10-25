// Runs the actual native component and r108 adapter on a browser canvas.
// This checks rendering and input, not WeChat compilation or device compatibility.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { modules } = require('../miniprogram/data/modules');
const { cases } = require('../miniprogram/data/cases');
const theme = require('../miniprogram/config/dna-theme');
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'output/playwright/free-first');
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const errors = [];
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }

try {
  for (const { width, mode } of [320, 360, 430, 900].flatMap(width => ['dna', 'universe'].map(mode => ({ width, mode })))) {
    const height = mode === 'universe' ? 240 : width > 430 ? 430 : width === 320 ? 320 : 400;
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<style>html,body{margin:0;background:#080b11;overflow:hidden}canvas{width:${width}px;height:${height}px;display:block;touch-action:none}</style><canvas id="scene"></canvas>`);
    await page.evaluate(() => { window.exports = {}; });
    await page.addScriptTag({ path: join(root, 'miniprogram/node_modules/threejs-miniprogram/dist/index.js') });
    await page.addScriptTag({ path: join(root, 'miniprogram/utils/dna-renderer.js') });
    await page.evaluate(({ theme, nodes, width, height, mode }) => {
      const canvas = document.querySelector('canvas');
      canvas.createImage = () => new Image();
      const pendingFrames = new Set();
      window.nativePendingFrames = pendingFrames;
      canvas.requestAnimationFrame = callback => {
        const id = requestAnimationFrame(timestamp => { pendingFrames.delete(id); callback(timestamp); });
        pendingFrames.add(id);
        return id;
      };
      canvas.cancelAnimationFrame = id => { pendingFrames.delete(id); cancelAnimationFrame(id); };
      const adapter = window.exports;
      const dna = window.QingchuangDnaRenderer(theme);
      window.require = id => id.includes('dna-renderer') ? dna : adapter;
      window.wx = {
        getDeviceInfo: () => ({ benchmarkLevel: 20 }),
        getWindowInfo: () => ({ windowWidth: width, pixelRatio: 1 })
      };
      window.Component = specification => {
        window.nativeSpecification = specification;
        window.nativeDna = {
          ...specification.methods,
          renderer: 'webview',
          data: { mode, items: nodes, selectedId: '', reducedMotion: false, paused: false, covered: false },
          setData(update, callback) { Object.assign(this.data, update); callback?.(); },
          createSelectorQuery() {
            let bounds = false;
            const query = {
              select() { return query; }, node() { return query; },
              boundingClientRect() { bounds = true; return query; },
              exec(callback) {
                try { callback([bounds ? { width, height } : { node: canvas }]); }
                catch (error) { window.nativeInitError ||= error.stack; throw error; }
              }
            };
            return query;
          },
          triggerEvent(name, data) { window.lastSelection = data; }
        };
        specification.pageLifetimes.show.call(window.nativeDna);
        specification.lifetimes.ready.call(window.nativeDna);
      };
      const point = event => ({ x: event.offsetX, y: event.offsetY });
      canvas.addEventListener('pointerdown', event => window.nativeDna.onTouchStart({ touches: [point(event)] }));
      canvas.addEventListener('pointermove', event => { if (event.buttons) window.nativeDna.onTouchMove({ touches: [point(event)] }); });
      canvas.addEventListener('pointerup', event => window.nativeDna.onTouchEnd({ changedTouches: [point(event)] }));
    }, { theme, nodes: mode === 'dna' ? modules : cases, width, height, mode });
    await page.addScriptTag({ path: join(root, 'miniprogram/utils/orbit.js') });
    await page.addScriptTag({ path: join(root, 'miniprogram/components/space-scene/space-scene.js') });
    await page.waitForFunction(() => window.nativeDna?.readyOnce, null, { timeout: 5000 }).catch(async error => { throw new Error(`${error.message}; ${await page.evaluate(() => window.nativeInitError)}; gl:${await page.evaluate(() => window.nativeDna?.glInitError)}; ${errors.join('; ')}`); });
    await page.waitForTimeout(150);
    const initial = await page.evaluate(() => {
      const c = window.nativeDna;
      c.glRenderer.render(c.scene, c.camera);
      const gl = c.glRenderer.getContext();
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let colored = 0;
      let clipped = 0;
      const hues = { blue: 0, green: 0, yellow: 0, purple: 0 };
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b, a] = pixels.subarray(i, i + 4);
        if (r + g + b <= 120 || a <= 100) continue;
        colored++;
        if (r > 245 && g > 245 && b > 245) clipped++;
        if (b > r + 15 && g > r + 10 && b >= g) hues.blue++;
        if (g > r + 15 && g > b + 8) hues.green++;
        if (r > b + 15 && g > b + 15 && Math.abs(r - g) < 25) hues.yellow++;
        if (b > g + 12 && r > g + 6) hues.purple++;
      }
      c.scene.updateMatrixWorld(true);
      const framed = c.clickable.every(sphere => {
        const point = sphere.getWorldPosition(new c.THREE.Vector3()).project(c.camera);
        return Math.abs(point.x) < .91 && Math.abs(point.y) < .91;
      });
      return {
        colored, clipped, hues, framed, rotation: c.root.rotation.y, orbitTime: c.orbitTime || 0,
        count: c.clickable.length, revision: c.THREE.REVISION,
        caseIds: c.clickable.filter(mesh => mesh.userData.id !== 'core').map(mesh => mesh.userData.id),
        coreCount: c.clickable.filter(mesh => mesh.userData.id === 'core').length
      };
    });
    check(initial.revision === '108', 'native library is the installed WeChat adapter');
    if (mode === 'universe') {
      check(initial.count === cases.length + 1, 'native universe exposes every case planet plus the library-entry core');
      check(initial.coreCount === 1, 'native universe keeps exactly one clickable library-entry core');
      check(new Set(initial.caseIds).size === cases.length && cases.every(item => initial.caseIds.includes(item.id)), 'all native case identities remain selectable without missing or duplicate planets');
      check(initial.colored > 1000, 'native universe is nonblank');
      check(initial.framed, 'native universe planets fit the viewport');
      check(await page.evaluate(() => window.nativeDna.root.children.some(mesh => mesh.material?.wireframe && String(mesh.geometry?.type || '').startsWith('Icosahedron'))), 'native main planet keeps the faceted gold wireframe look');
      await page.waitForTimeout(160);
      check(await page.evaluate(value => window.nativeDna.root.rotation.y === value, initial.rotation), 'native universe keeps its overall composition stable');
      check(await page.evaluate(value => window.nativeDna.orbitTime > value, initial.orbitTime), 'native universe advances its time-based orbits');
      const flightBefore = await page.evaluate(() => window.nativeDna.orbiters.map(orbiter => orbiter.mesh.position.toArray()));
      await page.waitForTimeout(420);
      const flightAfter = await page.evaluate(() => window.nativeDna.orbiters.map(orbiter => orbiter.mesh.position.toArray()));
      const travel = flightAfter.map((position, index) => Math.hypot(
        position[0] - flightBefore[index][0], position[1] - flightBefore[index][1], position[2] - flightBefore[index][2]
      ));
      const moved = travel.filter(distance => distance > .002).length;
      check(moved > cases.length * .8, `native universe planets fly on their own orbits (${moved}/${cases.length} moved)`);
      check(await page.evaluate(() => new Set(window.nativeDna.orbiters.map(orbiter => orbiter.traits.speed.toFixed(6))).size === 5), 'native universe keeps five orderly rings at distinct orbital speeds');
      const framedWhileFlying = await page.evaluate(() => {
        const c = window.nativeDna;
        c.scene.updateMatrixWorld(true);
        return c.clickable.every(mesh => {
          const projected = mesh.getWorldPosition(new c.THREE.Vector3()).project(c.camera);
          return Math.abs(projected.x) < .98 && Math.abs(projected.y) < .98 && projected.z < 1;
        });
      });
      check(framedWhileFlying, 'native universe planets stay inside the frame while flying');
      await page.evaluate(() => {
        window.nativeDna.data.paused = true;
        window.nativeSpecification.observers['paused,reducedMotion'].call(window.nativeDna);
      });
      const pausedTime = await page.evaluate(() => window.nativeDna.orbitTime);
      await page.waitForTimeout(160);
      check(await page.evaluate(time => window.nativeDna.orbitTime === time && window.nativePendingFrames.size === 0, pausedTime), 'native universe pause freezes flight without idle RAF work');
      await page.evaluate(() => {
        window.nativeDna.data.paused = false;
        window.nativeSpecification.observers['paused,reducedMotion'].call(window.nativeDna);
      });
      await page.waitForTimeout(100);
      check(await page.evaluate(time => window.nativeDna.orbitTime > time && window.nativePendingFrames.size === 1, pausedTime), 'native universe resume restores exactly one animation loop');
      await page.evaluate(() => window.nativeSpecification.pageLifetimes.hide.call(window.nativeDna));
      const hiddenTime = await page.evaluate(() => window.nativeDna.orbitTime);
      await page.waitForTimeout(100);
      check(await page.evaluate(time => window.nativeDna.orbitTime === time && window.nativePendingFrames.size === 0, hiddenTime), 'native universe page hide cancels rendering');
      await page.evaluate(() => {
        window.nativeSpecification.pageLifetimes.show.call(window.nativeDna);
        window.nativeSpecification.pageLifetimes.show.call(window.nativeDna);
      });
      await page.waitForTimeout(100);
      check(await page.evaluate(time => window.nativeDna.orbitTime > time && window.nativeDna.orbitTime - time < .2 && window.nativePendingFrames.size === 1, hiddenTime), 'native universe page show resumes smoothly without duplicate RAF loops');
      await page.evaluate(() => {
        window.nativeDna.data.reducedMotion = true;
        window.nativeSpecification.observers['paused,reducedMotion'].call(window.nativeDna);
      });
      await page.waitForTimeout(140);
      const frozenBefore = await page.evaluate(() => window.nativeDna.orbiters.map(orbiter => orbiter.mesh.position.toArray()));
      await page.waitForTimeout(280);
      const frozenAfter = await page.evaluate(() => window.nativeDna.orbiters.map(orbiter => orbiter.mesh.position.toArray()));
      check(frozenAfter.every((position, index) => position.every((value, axis) => Math.abs(value - frozenBefore[index][axis]) < 1e-6)), 'native universe respects reduced motion');
      check(await page.evaluate(() => window.nativePendingFrames.size === 0), 'native universe reduced-motion view does not waste animation frames');
      await page.evaluate(() => {
        window.nativeDna.data.reducedMotion = false;
        window.nativeSpecification.observers['paused,reducedMotion'].call(window.nativeDna);
      });
      await page.screenshot({ path: join(artifacts, `native-universe-${width}-flight.png`) });
      await page.evaluate(() => window.nativeDna.dispose());
      await page.close();
      continue;
    }
    check(initial.count === modules.length * 2, 'native renderer has two clickable balls per node');
    check(initial.colored > 1000, 'native component renders a nonblank DNA');
    check(initial.clipped < initial.colored * .1, 'native bubbles are not overexposed to white');
    check(Object.values(initial.hues).every(count => count > 30), 'native pixels preserve distinct blue, green, yellow and purple stage hues');
    check(initial.framed, 'native DNA fits the initial viewport');
    await page.waitForTimeout(160);
    check(await page.evaluate(value => window.nativeDna.root.rotation.y !== value, initial.rotation), 'native DNA is moving');
    await page.screenshot({ path: join(artifacts, `native-dna-${width}.png`) });

    for (const side of ['A', 'B']) {
      const target = await page.evaluate(side => {
        const c = window.nativeDna;
        c.scene.updateMatrixWorld(true);
        const candidates = c.clickable.filter(mesh => mesh.userData.side === side).map(mesh => ({ mesh, point: mesh.getWorldPosition(new c.THREE.Vector3()) })).sort((a, b) => b.point.z - a.point.z);
        const { mesh, point } = candidates[0];
        point.project(c.camera);
        return { id: mesh.userData.id, x: (point.x + 1) * c.width / 2, y: (1 - point.y) * c.height / 2 };
      }, side);
      await page.mouse.click(target.x, target.y);
      const selected = await page.evaluate(() => ({ id: window.lastSelection?.id, side: window.lastSelection?.side, leaders: window.nativeDna.dnaVisual.group.children.filter(mesh => mesh.userData.role === 'leader' && mesh.visible).length }));
      check(selected.id === target.id && selected.side === side, `real pointer event can pick native chain ${side}`);
      check(selected.leaders === 1, 'only the clicked ball has an outward leader');
    }
    const selectedRotation = await page.evaluate(() => window.nativeDna.root.rotation.y);
    await page.waitForTimeout(160);
    check(await page.evaluate(value => window.nativeDna.root.rotation.y === value, selectedRotation), 'selected native DNA pauses for reading');
    await page.screenshot({ path: join(artifacts, `native-dna-selected-${width}.png`) });
    await page.evaluate(() => window.nativeDna.applyDnaSelection(''));
    await page.waitForTimeout(1050);
    check(await page.evaluate(value => window.nativeDna.root.rotation.y !== value, selectedRotation), 'closing selection resumes native rotation');
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.down();
    await page.mouse.move(width / 2 + 55, height / 2 + 15, { steps: 8 });
    await page.mouse.up();
    check(await page.evaluate(() => window.nativeDna.root.rotation.x > .05), 'native drag rotates the model');
    await page.evaluate(() => { window.nativeDna.zoomView(-100); window.nativeDna.resetView(); });
    check(await page.evaluate(() => window.nativeDna.camera.position.z === window.nativeDna.dnaDefaultZoom), 'native view reset restores adaptive framing');
    await page.evaluate(() => {
      const c = window.nativeDna;
      c.data.covered = true;
      c.updateCovered(true);
      const image = new Image();
      image.id = 'snapshot';
      image.src = c.data.snapshot;
      document.body.append(image);
      document.querySelector('canvas').hidden = true;
    });
    check(await page.locator('#snapshot').evaluate(image => image.complete && image.naturalWidth > 0), 'covered native canvas keeps a valid selected-frame image');
    const paused = await page.evaluate(() => window.nativeDna.root.rotation.y);
    await page.waitForTimeout(100);
    check(await page.evaluate(value => window.nativeDna.root.rotation.y === value, paused), 'reading sheet suspends native rendering');
    await page.evaluate(() => {
      document.querySelector('#snapshot').remove();
      document.querySelector('canvas').hidden = false;
      window.nativeDna.data.covered = false;
      window.nativeDna.updateCovered(false);
    });
    await page.waitForTimeout(1050);
    check(await page.evaluate(value => window.nativeDna.root.rotation.y !== value, paused), 'closing reading sheet resumes the same model');
    await page.evaluate(() => window.nativeDna.dispose());
    await page.close();
  }
  check(errors.length === 0, `native component browser errors: ${errors.join('; ')}`);
  console.log(`Native DNA canvas harness: ${checks} passed; actual WeChat compile/device testing remains separate.`);
} finally {
  await browser.close();
}
