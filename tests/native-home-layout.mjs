// Projection of the real native home WXML/WXSS into a browser with WeChat-like
// button defaults. It exercises layout and the actual r108 canvas, not WXML
// compilation, native safe-area behavior, or a real WeChat device.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { caseSummaries, caseLibraryMeta } = require('../miniprogram/data/case-summaries');
const theme = require('../miniprogram/config/dna-theme');
const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const artifactDir = join(root, 'output/playwright/home-review-2026-10-25');
mkdirSync(artifactDir, { recursive: true });
const source = read('miniprogram/pages/home/home.wxml');
const styles = read('miniprogram/app.wxss') + '\n' + read('miniprogram/pages/home/home.wxss');
const data = { caseLibraryMeta, reducedMotion: false, orbitPaused: false, showPrivacy: false,
  cases: caseSummaries, adSlot: { enabled: false, unitId: '', placement: '', adType: '' } };
const rpx = (css, width) => css.replace(/(-?\d*\.?\d+)rpx/g, (_, value) => `${Number(value) * width / 750}px`);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const failures = [];
let checks = 0;
const verify = (value, message) => { assert.ok(value, message); checks++; };

try {
  for (const device of [
    { width: 320, height: 568, tab: 50, safeTop: 72 },
    { width: 360, height: 780, tab: 50, safeTop: 88 },
    { width: 390, height: 844, tab: 84, safeTop: 96 },
    { width: 667, height: 375, tab: 50, safeTop: 44 },
    { width: 844, height: 390, tab: 50, safeTop: 44 },
  ]) {
    const windowHeight = device.height - device.tab;
    const page = await browser.newPage({ viewport: { width: device.width, height: windowHeight } });
    page.on('pageerror', error => failures.push(error.message));
    const markup = source.replace(/\{\{([\s\S]*?)\}\}/g, (_, expression) => String(vm.runInNewContext(expression, data)))
      .replace(/disabled="false"/g, '')
      .replace(/<safe-top([^>]*)>/, `<safe-top$1 style="height:${device.safeTop}px">`);
    await page.setContent(`<style>
      html,body{margin:0;width:100%;height:100%;overflow:hidden}page,view{display:block}page{height:100%}
      text{display:inline}button{position:relative;display:block;width:100%;margin-left:auto;margin-right:auto;padding:0 14px;font-size:18px;line-height:2.55556;text-align:center;border:0;flex-shrink:0}
      galaxy-backdrop{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 45% 65%,#0e1828,transparent 65%)}
      safe-top,space-scene{display:block}ad-slot,privacy-popup{display:none}
      .scene-shell,.scene-shell canvas{display:block;width:100%;height:100%}
      ${rpx(styles, device.width)}
    </style><page>${markup}</page>`);
    // Use the real native canvas component inside the projected home layout.
    await page.evaluate(() => { window.exports = {}; });
    await page.addScriptTag({ path: join(root, 'miniprogram/node_modules/threejs-miniprogram/dist/index.js') });
    await page.addScriptTag({ path: join(root, 'miniprogram/utils/dna-renderer.js') });
    await page.addScriptTag({ path: join(root, 'miniprogram/utils/orbit.js') });
    await page.evaluate(({ theme, nodes, width }) => {
      const host = document.querySelector('space-scene');
      host.innerHTML = '<div class="scene-shell"><canvas id="webgl"></canvas></div>';
      const canvas = host.querySelector('canvas');
      canvas.createImage = () => new Image();
      canvas.requestAnimationFrame = requestAnimationFrame.bind(window);
      canvas.cancelAnimationFrame = cancelAnimationFrame.bind(window);
      const adapter = window.exports;
      window.require = id => id.includes('dna-renderer') ? window.QingchuangDnaRenderer(theme) : id.endsWith('/orbit') ? window.QingchuangOrbit : adapter;
      window.wx = { getDeviceInfo: () => ({ benchmarkLevel: 20 }), getWindowInfo: () => ({ windowWidth: width, pixelRatio: 1 }) };
      window.Component = specification => {
        const component = {
          ...specification.methods,
          data: { mode: 'universe', items: nodes, selectedId: '', covered: false, paused: true, reducedMotion: false },
          setData(update, callback) { Object.assign(this.data, update); callback?.(); },
          triggerEvent() {},
          createSelectorQuery() {
            let bounds = false;
            const query = { select() { return query; }, node() { return query; }, boundingClientRect() { bounds = true; return query; },
              exec(callback) { const rect = host.getBoundingClientRect(); callback([bounds ? { width: rect.width, height: rect.height } : { node: canvas }]); } };
            return query;
          }
        };
        window.nativeHomeScene = component;
        specification.pageLifetimes.show.call(component);
        specification.lifetimes.ready.call(component);
      };
    }, { theme, nodes: caseSummaries, width: device.width });
    await page.addScriptTag({ path: join(root, 'miniprogram/components/space-scene/space-scene.js') });
    await page.waitForFunction(() => window.nativeHomeScene?.readyOnce, null, { timeout: 5000 });
    const layout = await page.evaluate(() => {
      const bounds = element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }; };
      return { actions: [...document.querySelectorAll('.home-actions button')].map(bounds),
        controls: [...document.querySelectorAll('.orbit-button')].map(bounds),
        state: bounds(document.querySelector('.orbit-state')), scene: bounds(document.querySelector('.universe-viewport')),
        overflow: document.documentElement.scrollWidth > innerWidth,
        textsFit: [...document.querySelectorAll('.home-actions button,.orbit-button,.orbit-state')].every(element => element.scrollWidth <= element.clientWidth + 1),
        windowHeight: innerHeight };
    });
    const label = `${device.width}×${device.height} (native window ${windowHeight})`;
    await page.screenshot({ path: join(artifactDir, `native-home-layout-${device.width}x${device.height}.png`) });
    for (const [name, pair] of [['CTA', layout.actions], ['orbit controls', layout.controls]]) {
      verify(Math.abs(pair[0].width - pair[1].width) <= 1, `${label}: ${name} equally wide`);
      verify(Math.abs(pair[0].height - pair[1].height) <= 1 && pair.every(item => item.height >= 44), `${label}: ${name} equally tall with 44px targets`);
      verify(pair.every(item => item.x >= 0 && item.right <= device.width + 1 && item.y >= 0 && item.bottom <= windowHeight + 1), `${label}: ${name} stays in view`);
    }
    verify(layout.state.width >= 200 && layout.state.height <= 18, `${label}: motion state remains one horizontal line`);
    verify(layout.state.bottom <= layout.controls[0].y + 1, `${label}: status has its own row above controls`);
    verify(layout.scene.height >= 160 && layout.scene.bottom <= windowHeight + 1, `${label}: enough canvas remains without clipping (${layout.scene.height.toFixed(1)}px at y=${layout.scene.y.toFixed(1)})`);
    verify(!layout.overflow && layout.textsFit, `${label}: no horizontal overflow or clipped labels`);
    console.log(`${label}: CTA=${layout.actions[0].width.toFixed(1)}px × ${layout.actions[0].height}px; orbit=${layout.controls[0].width.toFixed(1)}px × ${layout.controls[0].height}px; scene=${layout.scene.width.toFixed(1)}px × ${layout.scene.height.toFixed(1)}px`);
    await page.evaluate(() => window.nativeHomeScene.dispose());
    await page.close();
  }
  verify(failures.length === 0, `no browser errors: ${failures.join('; ')}`);
  console.log(`Native home layout projection: ${checks} passed. Actual WeChat compile and device verification remain separate.`);
} finally { await browser.close(); }
