import { createRequire } from 'node:module';
const require = createRequire('file:///D:/UserFolders/Desktop/qingchuang-pinpin/tests/');
const { modules } = require('D:/UserFolders/Desktop/qingchuang-pinpin/miniprogram/data/modules');
const { cases } = require('D:/UserFolders/Desktop/qingchuang-pinpin/miniprogram/data/cases');
const { chromium } = require('playwright');
const root = 'D:/UserFolders/Desktop/qingchuang-pinpin/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const width = 360, height = 240;
const page = await browser.newPage({ viewport: { width, height } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.setContent('<style>html,body{margin:0;background:#080b11}canvas{width:360px;height:240px;display:block}</style><canvas id="scene"></canvas>');
await page.evaluate(() => { window.exports = {}; });
await page.addScriptTag({ path: root + 'miniprogram/node_modules/threejs-miniprogram/dist/index.js' });
await page.addScriptTag({ path: root + 'miniprogram/utils/dna-renderer.js' });
await page.evaluate(({ nodes, width, height }) => {
  const canvas = document.querySelector('canvas');
  canvas.createImage = () => new Image();
  canvas.requestAnimationFrame = requestAnimationFrame.bind(window);
  canvas.cancelAnimationFrame = cancelAnimationFrame.bind(window);
  const adapter = window.exports;
  const dna = window.QingchuangDnaRenderer(window.QingchuangDnaTheme);
  window.require = id => id.includes('dna-renderer') ? dna : adapter;
  window.wx = { getDeviceInfo: () => ({ benchmarkLevel: 20 }), getWindowInfo: () => ({ windowWidth: width, pixelRatio: 1 }) };
  window.Component = specification => {
    window.nativeDna = {
      ...specification.methods,
      data: { mode: 'universe', items: nodes, selectedId: '', reducedMotion: false, paused: false, covered: false },
      setData(update, callback) { Object.assign(this.data, update); callback?.(); },
      createSelectorQuery() {
        const query = {
          select() { return query; }, node() { return query; },
          boundingClientRect() { return query; }, fields() { return query; },
          exec(callback) { callback([{ node: canvas, width, height }]); }
        };
        return query;
      },
      triggerEvent() {}
    };
    specification.pageLifetimes.show.call(window.nativeDna);
    specification.lifetimes.ready.call(window.nativeDna);
  };
}, { nodes: cases, width, height });
await page.addScriptTag({ path: root + 'miniprogram/utils/orbit.js' });
await page.addScriptTag({ path: root + 'miniprogram/components/space-scene/space-scene.js' });
await page.waitForTimeout(800);
const info = await page.evaluate(() => {
  const c = window.nativeDna;
  let probe = null;
  try {
    const T = c.THREE;
    const g = new T.SphereGeometry(1, 8, 6);
    probe = {
      keys: Object.keys(g).slice(0, 20),
      hasAttributes: Boolean(g.attributes),
      attrType: g.attributes && Object.keys(g.attributes),
      protoKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(g)).slice(0, 20),
      sphereType: typeof T.SphereGeometry,
      revision: T.REVISION
    };
  } catch (e) { probe = 'ERR:' + e.message; }
  return {
    ready: c?.readyOnce,
    glError: c?.glInitError,
    fallback: Boolean(c?.fallbackCtx),
    probe
  };
});
console.log(JSON.stringify(info, null, 2).slice(0, 4000));
await browser.close();