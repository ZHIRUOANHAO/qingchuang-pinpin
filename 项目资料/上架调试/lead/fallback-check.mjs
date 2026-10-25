// 验证低性能 Canvas 2D 降级视图：星球同样按各自轨迹飞行、可点击、无运行时报错。
import { createRequire } from 'node:module';
const require = createRequire('file:///D:/UserFolders/Desktop/qingchuang-pinpin/tests/');
const { chromium } = require('playwright');
const root = 'D:/UserFolders/Desktop/qingchuang-pinpin/';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 360, height: 260 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.setContent('<style>html,body{margin:0;background:#080b11;overflow:hidden}canvas{display:block;width:360px;height:240px}</style><canvas id="scene"></canvas><canvas id="fallback"></canvas>');
await page.addScriptTag({ path: root + 'miniprogram/utils/orbit.js' });
await page.evaluate(() => {
  const scene = document.querySelector('#scene');
  const fallback = document.querySelector('#fallback');
  fallback.requestAnimationFrame = requestAnimationFrame.bind(window);
  fallback.cancelAnimationFrame = cancelAnimationFrame.bind(window);
  const width = 360; const height = 240;
  window.__cases = Array.from({ length: 100 }, (_, index) => ({ id: 'case_' + index, title: '案例 ' + index, planet: { color: ['#d9bb72', '#9b87e8', '#62c7d9', '#65c799', '#aab4c7'][index % 5] } }));
  window.require = () => ({});
  window.wx = { getDeviceInfo: () => ({ benchmarkLevel: 4 }), getWindowInfo: () => ({ windowWidth: width, pixelRatio: 1 }) };
  window.Component = specification => {
    window.nativeUniverse = {
      ...specification.methods,
      data: { mode: 'universe', items: window.__cases, selectedId: '', reducedMotion: false },
      setData(update, callback) { Object.assign(this.data, update); callback?.(); },
      createSelectorQuery() {
        let fallbackCanvas = false;
        const query = {
          select(selector) { fallbackCanvas = selector === '#fallback'; return query; },
          node() { return query; },
          fields() { return query; },
          boundingClientRect() { return query; },
          exec(callback) { callback([fallbackCanvas ? { node: fallback, width, height } : { node: scene, width, height }]); }
        };
        return query;
      },
      triggerEvent(name, data) { window.lastSelection = data; }
    };
    specification.lifetimes.ready.call(window.nativeUniverse);
  };
});
await page.addScriptTag({ path: root + 'miniprogram/components/space-scene/space-scene.js' });
await page.waitForTimeout(400);
const start = await page.evaluate(() => ({
  fallback: Boolean(window.nativeUniverse.fallbackCtx),
  points: (window.nativeUniverse.fallbackPoints || []).length,
  core: (window.nativeUniverse.fallbackPoints || []).filter(point => point.item && point.item.id === 'core').length,
  time: window.nativeUniverse.fallbackTime,
  positions: (window.nativeUniverse.fallbackPoints || []).slice(0, 30).map(point => [Math.round(point.x), Math.round(point.y)])
}));
await page.waitForTimeout(500);
const end = await page.evaluate(() => ({
  time: window.nativeUniverse.fallbackTime,
  positions: (window.nativeUniverse.fallbackPoints || []).slice(0, 30).map(point => [Math.round(point.x), Math.round(point.y)])
}));
const moved = end.positions.filter((position, index) => position[0] !== start.positions[index][0] || position[1] !== start.positions[index][1]).length;
const distinct = new Set(end.positions.map(position => position.join(','))).size;
const canvasShot = await page.locator('#fallback').screenshot();
console.log(JSON.stringify({
  fallbackActive: start.fallback,
  points: start.points,
  coreAnchors: start.core,
  animationAdvanced: end.time > start.time,
  planetsMoved: moved + '/30',
  distinctPositions: distinct + '/30',
  canvasBytes: canvasShot.length,
  errors
}, null, 2));
await browser.close();
if (!start.fallback || start.points !== 101 || !(end.time > start.time) || moved < 24 || errors.length) process.exit(1);
