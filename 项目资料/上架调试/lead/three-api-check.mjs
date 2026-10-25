import { createRequire } from 'node:module';
const require = createRequire('file:///D:/UserFolders/Desktop/qingchuang-pinpin/tests/');
const { chromium } = require('playwright');
const root = 'D:/UserFolders/Desktop/qingchuang-pinpin/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
await page.evaluate(() => { window.exports = {}; });
await page.addScriptTag({ path: root + 'miniprogram/node_modules/threejs-miniprogram/dist/index.js' });
const info = await page.evaluate(() => {
  const T = window.exports;
  const attr = new T.BufferAttribute(new Float32Array(3), 3);
  const geom = new T.SphereGeometry(1, 8, 6);
  let getX = null;
  try { getX = attr.getX(0); } catch (e) { getX = 'ERR:' + e.message; }
  return {
    revision: T.REVISION,
    attrHasGetX: typeof attr.getX,
    getX,
    geomPosCount: geom.attributes.position.count,
    geomGetX: typeof geom.attributes.position.getX,
    addAttribute: typeof geom.addAttribute,
    float32: typeof T.Float32BufferAttribute,
    vertexColors: 'vertexColors' in new T.MeshStandardMaterial()
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
