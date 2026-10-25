import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('file:///D:/UserFolders/Desktop/qingchuang-pinpin/tests/');
const { chromium } = require('playwright');
const out = 'D:/UserFolders/Desktop/qingchuang-pinpin/项目资料/上架调试/lead/sunshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:4173/preview/?v=' + Date.now(), { waitUntil: 'networkidle' });
await page.locator('#universe-canvas').waitFor({ state: 'visible' });
await page.waitForTimeout(1400);
await page.locator('#universe-canvas').screenshot({ path: join(out, 'home-hires.png') });
const info = await page.evaluate(() => {
  const canvas = document.querySelector('#universe-canvas');
  return { width: canvas.width, height: canvas.height, modules: performance.getEntriesByType('resource').filter(r => r.name.includes('scene.js')).map(r => r.name) };
});
console.log(JSON.stringify(info));
await browser.close();
