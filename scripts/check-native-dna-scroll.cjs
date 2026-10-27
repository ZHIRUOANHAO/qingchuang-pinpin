// Runs against a locally open WeChat DevTools simulator; never uploads code.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const automatorPath = process.env.WX_AUTOMATOR_PATH || path.join(root, 'output/wx-automation/node_modules/miniprogram-automator');
const automator = require(automatorPath);
const { PNG } = require(require.resolve('pngjs', { paths: [path.dirname(require.resolve(automatorPath))] }));
const phase = process.argv[2] || 'after';
const output = path.join(root, 'output/playwright/dna-scroll-2026-10-26');
fs.mkdirSync(output, { recursive: true });

function paintedModel(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const mask = new Uint8Array(png.width * png.height);
  for (let index = 0; index < mask.length; index++) {
    const [r, g, b] = png.data.subarray(index * 4, index * 4 + 3);
    if (g > 105 && g >= r + 12 && g >= b + 6) mask[index] = 1;
  }
  let pixels = 0, totalY = 0, clusters = 0;
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index]) continue;
    mask[index] = 0;
    const pending = [index];
    let area = 0, sumY = 0, minX = png.width, maxX = 0, minY = png.height, maxY = 0;
    while (pending.length) {
      const position = pending.pop(), x = position % png.width, y = Math.floor(position / png.width);
      area++; sumY += y;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const neighbors = [y > 0 ? position - png.width : -1, y < png.height - 1 ? position + png.width : -1, x > 0 ? position - 1 : -1, x < png.width - 1 ? position + 1 : -1];
      for (const neighbor of neighbors) if (neighbor >= 0 && mask[neighbor]) { mask[neighbor] = 0; pending.push(neighbor); }
    }
    // Large connected green regions belong to spheres; tiny legend dots and text are excluded.
    if (area >= 100 && maxX - minX >= 12 && maxY - minY >= 12) { pixels += area; totalY += sumY; clusters++; }
  }
  assert.ok(pixels > 800 && clusters >= 2, 'screenshots contain identifiable model spheres');
  return { width: png.width, pixels, clusters, centroidY: totalY / pixels };
}

function verifyPaint(result) {
  const a = paintedModel(path.join(output, `${phase}-scroll-a.png`));
  const b = paintedModel(path.join(output, `${phase}-scroll-b.png`));
  const expectedTravel = result.viewportTravel * a.width / result.before.size.width;
  const paintTravel = a.centroidY - b.centroidY;
  const followsPage = Math.abs(paintTravel - expectedTravel) < 8;
  result.paint = { before: a, after: b, expectedTravel, paintTravel, followsPage };
  result.passed = followsPage;
  fs.writeFileSync(path.join(output, `${phase}-result.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  if (phase === 'after') assert.ok(followsPage, 'painted model follows the page, not just the Canvas DOM bounds');
  console.log(JSON.stringify(result));
}

(async () => {
  if (process.argv.includes('--analyze-only')) {
    verifyPaint(JSON.parse(fs.readFileSync(path.join(output, `${phase}-result.json`), 'utf8')));
    return;
  }
  const app = await automator.connect({ wsEndpoint: process.env.WX_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9521' });
  let scene;
  try {
    let page = await app.currentPage();
    if (page.path !== 'pages/ai/ai') page = await app.switchTab('/pages/ai/ai');
    if (!(await page.$('.result-dna'))) {
      const load = await page.$('.load-demo');
      assert.ok(load, 'demo loader is available');
      await load.tap();
      await page.waitFor('.result-dna');
    }
    const scroll = await page.$('scroll-view');
    if (phase === 'after') assert.equal(scroll, null, 'demo uses one page scroll surface');
    const scrollTo = async top => {
      if (scroll) await scroll.scrollTo(0, top);
      else await app.pageScrollTo(top);
      await page.waitFor(300);
    };
    await scrollTo(0);
    const region = await page.$('.result-dna');
    // DevTools exposes custom-component host aliases as "component".
    const dna = await region.$('*');
    const viewport = await dna.$('.viewport');
    scene = await dna.$('#scene');
    const canvas = await scene.$('canvas');
    assert.ok(viewport && scene && canvas, 'native DNA viewport and canvas exist');
    await scene.setData({ paused: true });
    const initial = await viewport.offset();
    const firstTop = Math.max(0, initial.top - 160);
    await scrollTo(firstTop);
    const before = { viewport: await viewport.offset(), canvas: await canvas.offset(), size: await viewport.size(), canvasSize: await canvas.size() };
    await app.screenshot({ path: path.join(output, `${phase}-scroll-a.png`) });
    await scrollTo(firstTop + 150);
    const after = { viewport: await viewport.offset(), canvas: await canvas.offset(), size: await viewport.size(), canvasSize: await canvas.size() };
    await app.screenshot({ path: path.join(output, `${phase}-scroll-b.png`) });
    const viewportTravel = before.viewport.top - after.viewport.top;
    const canvasTravel = before.canvas.top - after.canvas.top;
    assert.ok(viewportTravel > 120, 'page actually moved through the model region');
    assert.ok(Math.abs(viewportTravel - canvasTravel) < 2, 'canvas and containing viewport move together');
    assert.ok(Math.abs(before.canvas.top - before.viewport.top) < 2 && Math.abs(after.canvas.top - after.viewport.top) < 2, 'canvas remains anchored to the viewport');
    assert.ok(Math.abs(after.size.height - after.canvasSize.height) < 2, 'canvas remains within its bounded region');
    const result = { phase, route: page.path, innerScroll: !!scroll, before, after, viewportTravel, canvasTravel, passed: true, limitation: 'DevTools simulator geometry and screenshots; phone paint-layer behavior still needs verification.' };
    verifyPaint(result);
  } finally {
    if (scene) { try { await scene.setData({ paused: false }); } catch {} }
    app.disconnect();
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
