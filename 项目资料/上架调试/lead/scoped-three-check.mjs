import { createRequire } from 'node:module';
const require = createRequire('file:///D:/UserFolders/Desktop/qingchuang-pinpin/tests/');
const { chromium } = require('playwright');
const root = 'D:/UserFolders/Desktop/qingchuang-pinpin/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage();
await page.setContent('<canvas id="c" width="320" height="240"></canvas>');
await page.evaluate(() => { window.exports = {}; });
await page.addScriptTag({ path: root + 'miniprogram/node_modules/threejs-miniprogram/dist/index.js' });
const info = await page.evaluate(() => {
  const canvas = document.querySelector('#c');
  canvas.createImage = () => new Image();
  const adapter = window.exports;
  const T = adapter.createScopedThreejs(canvas);
  const g = new T.SphereGeometry(1, 8, 6);
  const proto = Object.getPrototypeOf(g);
  return {
    adapterKeys: Object.keys(adapter).slice(0, 20),
    revision: T.REVISION,
    geoKeys: Object.keys(g).slice(0, 30),
    hasAttributes: 'attributes' in g,
    attributes: g.attributes ? Object.keys(g.attributes) : null,
    protoNames: Object.getOwnPropertyNames(proto).slice(0, 40),
    addAttribute: typeof g.addAttribute,
    setAttribute: typeof g.setAttribute
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
