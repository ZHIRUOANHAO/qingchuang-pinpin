import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('file:///D:/UserFolders/Desktop/qingchuang-pinpin/tests/');
const { chromium } = require('playwright');
const out = 'D:/UserFolders/Desktop/qingchuang-pinpin/项目资料/上架调试/lead/flight-frames';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4173/preview/', { waitUntil: 'networkidle' });
const canvas = page.locator('#universe-canvas');
await canvas.waitFor({ state: 'visible' });
await page.waitForTimeout(800);
const box = await canvas.boundingBox();
console.log('canvas box', JSON.stringify(box));
for (let frame = 0; frame < 40; frame += 1) {
  await canvas.screenshot({ path: join(out, 'frame-' + String(frame).padStart(3, '0') + '.png') });
  await page.waitForTimeout(100);
}
await browser.close();
console.log('frames captured');
