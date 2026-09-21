import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? require(process.env.PLAYWRIGHT_MODULE_PATH)
  : require('playwright');
const { chromium } = playwright;
const { cases: catalog } = require('../miniprogram/data/cases');
const testsDir = fileURLToPath(new URL('.', import.meta.url));
const artifacts = resolve(testsDir, '../output/playwright/free-first');
const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/preview/';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
mkdirSync(artifacts, { recursive: true });

const failures = [];
const passes = [];
const browserErrors = [];

function check(condition, message) {
  if (condition) passes.push(message);
  else failures.push(message);
}

async function canvasPixels(page, selector) {
  return page.locator(selector).evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { sampled: 0, colored: 0 };
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let sampled = 0;
    let colored = 0;
    let bright = 0;
    const stride = Math.max(4, Math.floor(pixels.length / 12000 / 4) * 4);
    for (let index = 0; index < pixels.length; index += stride) {
      sampled += 1;
      const luminance = pixels[index] + pixels[index + 1] + pixels[index + 2];
      if (luminance > 18 && pixels[index + 3] > 0) colored += 1;
      if (luminance > 500 && pixels[index + 3] > 0) bright += 1;
    }
    return { sampled, colored, bright };
  });
}

function captureErrors(page, label) {
  page.on('pageerror', (error) => browserErrors.push(`${label} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`${label} console: ${message.text()}`);
  });
}

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  desktop.setDefaultTimeout(8000);
  captureErrors(desktop, 'desktop');
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' });
  await desktop.locator('#universe-canvas').waitFor({ state: 'visible' });
  await desktop.waitForTimeout(500);
  check(await desktop.locator('.side-rail .nav-item').count() === 5, 'desktop renders five navigation tabs');
  check(await desktop.locator('h1').first().textContent() === '青创拼拼', 'desktop opens on the product-led home');
  check((await desktop.locator('.hero-thesis h2').textContent()).includes('一门生意如何运转'), 'home foregrounds understanding a real transaction without earnings claims');
  const universeHint = await desktop.locator('.hero-live').textContent();
  check(universeHint.includes('100 个案例全部免费阅读') && !universeHint.includes('付费'), 'home makes all 100 free cases explicit without a paid tier');
  check(await desktop.locator('.hero-actions .primary-button').getAttribute('data-action') === 'starter-cases', 'home prioritizes lower-cost starter projects');
  check(await desktop.locator('#universe-canvas').getAttribute('data-case-count') === '100', 'universe renderer receives all 100 cases');
  check(await desktop.locator('#universe-canvas').getAttribute('data-free-case-count') === '100', 'all 100 planets represent readable free cases');
  check((await desktop.locator('.home-scope').textContent()).includes('尚未覆盖全行业'), 'home discloses that the selected catalog is not a worldwide profit-verified database');
  check((await desktop.locator('.home-reading-guide').textContent()).includes('交付什么、钱如何到账'), 'home explains the buyer-to-delivery questions');
  const homePixels = await canvasPixels(desktop, '#universe-canvas');
  check(homePixels.colored > 100, `universe WebGL canvas contains rendered pixels (${homePixels.colored})`);
  check(await desktop.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'desktop has no document-level horizontal overflow');
  await desktop.screenshot({ path: join(artifacts, 'desktop-home.png'), fullPage: true });

  await desktop.locator('.hero-actions .primary-button').focus();
  await desktop.keyboard.press('Enter');
  check(await desktop.locator('.case-card').count() === catalog.filter(item => item.tags.includes('轻量试做')).length, 'keyboard starter CTA filters to actual lightweight trials instead of all mature businesses');

  await desktop.locator('.side-rail [data-tab="cases"]').click();
  await desktop.locator('[data-action="reset-cases"]').first().click();
  check(await desktop.locator('.case-card').count() === 100, 'case library renders all 100 catalog entries');
  check(await desktop.locator('.case-card.is-free').count() === 100, 'all 100 catalog cards offer free reading');
  check(await desktop.locator('.case-card.is-locked').count() === 0, 'no paid catalog cards remain');
  check(await desktop.locator('[data-access]').count() === 0, 'obsolete paid/free filters are removed from the interface');
  check((await desktop.locator('.case-card.is-free .case-card-head strong').allTextContents()).every(label => label === '免费全文'), 'every free card discloses complete free access before opening');
  await desktop.screenshot({ path: join(artifacts, 'desktop-cases.png') });
  const firstTag = catalog[0].tags[0];
  await desktop.getByRole('group', { name: '案例标签', exact: true }).getByRole('button', { name: firstTag, exact: true }).click();
  check(await desktop.locator('.case-card').count() === catalog.filter(item => item.tags.includes(firstTag)).length, 'tag filters work across the full free library');
  await desktop.locator('#case-search').fill(catalog[0].title);
  check(await desktop.locator('.case-card').count() === 1 && await desktop.locator('.case-card').getAttribute('data-case-id') === 'real_001', 'keyword search composes with tag filters');
  await desktop.locator('#case-search').fill('__no_matching_case_20260909__');
  check(await desktop.locator('.empty-state').isVisible() && await desktop.locator('.case-card').count() === 0, 'unmatched search shows an actionable empty state');
  await desktop.locator('.empty-state [data-action="reset-cases"]').click();
  check(await desktop.locator('.case-card').count() === 100 && await desktop.locator('#case-search').inputValue() === '', 'reset restores the complete catalog and clears the search');
  await desktop.locator('.case-card[data-case-id="real_001"]').click();
  check((await desktop.locator('.business-brief').textContent()).includes('可复制的 Notion 模板') && (await desktop.locator('.business-brief').textContent()).includes('任务与笔记分散'), 'free case opens with a concrete offer and its actual payer');
  check((await desktop.locator('.trade-summary').textContent()).includes('模板单品或组合购买'), 'free case exposes the case-specific charging model');
  check(await desktop.locator('.transaction-story li').count() === 7 && (await desktop.locator('.transaction-story li').first().textContent()).includes('卖什么') && (await desktop.locator('.transaction-story li').last().textContent()).includes('收钱'), 'readable story starts at the offer and ends at payment, not an abstract principle');
  check(await desktop.locator('.business-brief').evaluate(element => element.getBoundingClientRect().top < document.querySelector('#dna-canvas').getBoundingClientRect().top), 'plain-language case content precedes the DNA visualization');
  await desktop.screenshot({ path: join(artifacts, 'desktop-business-brief.png') });
  await desktop.locator('[data-action="bookmark"]').click();
  check(await desktop.locator('[data-action="bookmark"]').getAttribute('aria-pressed') === 'true', 'free case can be bookmarked with an explicit selected state');
  check(await desktop.locator('.source-panel a').count() > 0, 'free case shows real evidence links');
  await desktop.locator('#dna-canvas').waitFor({ state: 'visible' });
  await desktop.waitForTimeout(400);
  const dnaPixels = await canvasPixels(desktop, '#dna-canvas');
  check(dnaPixels.colored > 100, `DNA WebGL canvas contains rendered pixels (${dnaPixels.colored})`);
  check(dnaPixels.bright > 12, `DNA WebGL canvas preserves bright subject highlights (${dnaPixels.bright})`);
  check(await desktop.locator('.dna-stage-legend [data-stage-color]').count() === 5, 'DNA legend shows all five startup stages');
  const frameBefore = await desktop.locator('#dna-canvas').screenshot();
  await desktop.waitForTimeout(300);
  check(!frameBefore.equals(await desktop.locator('#dna-canvas').screenshot()), 'DNA rotates while no bubble is selected');
  const dnaBounds = await desktop.locator('#dna-canvas').boundingBox();
  await desktop.mouse.move(dnaBounds.x + dnaBounds.width / 2, dnaBounds.y + dnaBounds.height / 2);
  await desktop.mouse.down();
  await desktop.mouse.move(dnaBounds.x + dnaBounds.width / 2 + 90, dnaBounds.y + dnaBounds.height / 2 + 20, { steps: 8 });
  await desktop.mouse.up();
  check(await desktop.locator('.node-sheet').count() === 0, 'dragging the DNA does not accidentally open a node');
  await desktop.locator('[data-dna="reset"]').click();
  await desktop.locator('[data-dna="in"]').click();
  check(await desktop.locator('.node-ribbon [data-node-id]').count() === 7, 'free case exposes its own seven-stage node index');
  await desktop.locator('[data-node-id="real_001_business_positioning"]').first().click();
  check(await desktop.locator('.node-sheet').isVisible(), 'business-stage node opens an interactive asset-card sheet');
  check((await desktop.locator('.node-sheet').textContent()).includes('目标') && (await desktop.locator('.node-sheet').textContent()).includes('风险提示'), 'asset-card sheet exposes the goal, method, assets and risk boundary');
  await desktop.locator('[data-save-stage="real_001_business_positioning"]').click();
  check((await desktop.locator('[data-save-stage="real_001_business_positioning"]').textContent()).includes('已保存'), 'business-stage asset card can be saved locally');
  await desktop.locator('[data-action="close-node"]').click();
  check(await desktop.locator('.node-sheet').count() === 0, 'asset-card sheet closes without placing an incompatible stage id on the canvas');
  await desktop.screenshot({ path: join(artifacts, 'desktop-dna.png'), fullPage: true });

  await desktop.locator('[data-action="close-case"]').click();
  check(await desktop.locator('.case-card').count() === 100, 'returning from a detail preserves the complete free catalog');
  for (const id of ['real_021', 'real_060', 'real_100']) {
    await desktop.locator(`.case-card[data-case-id="${id}"]`).click();
    const expected = catalog.find(item => item.id === id);
    check(await desktop.locator('.transaction-story li').count() === 7, `${id}: previously restricted content exposes all seven stages`);
    check((await desktop.locator('.trade-summary').textContent()).includes(expected.delivery) && (await desktop.locator('.trade-summary').textContent()).includes(expected.moneyFlow), `${id}: specific delivery and cash flow are visible`);
    check(await desktop.locator('#dna-canvas').count() === 1 && await desktop.locator('.source-panel a').count() > 0, `${id}: full DNA and source links remain available`);
    check(await desktop.locator('.locked-case-panel, dialog[open]').count() === 0, `${id}: reading requires neither an upsell nor an ad gate`);
    if (id === 'real_021') {
      await desktop.screenshot({ path: join(artifacts, 'desktop-newly-free-detail.png') });
      await desktop.locator('[data-action="case-to-canvas"]').click();
      check(await desktop.locator('[data-remove-node="real_021_stage_7"]').count() === 1, 'a previously restricted case can place its final payment stage in the canvas');
      check(await desktop.locator('[data-remove-node="real_021_stage_1"]').count() === 1, 'adding a newly free case preserves the complete case-specific draft');
      await desktop.locator('.side-rail [data-tab="cases"]').click();
    } else await desktop.locator('[data-action="close-case"]').click();
  }

  await desktop.locator('.side-rail [data-tab="ai"]').click();
  check(await desktop.locator('textarea, input[type="file"]').count() === 0 && (await desktop.locator('.demo-boundary').textContent()).includes('不调用外部接口'), 'case demo has no prompt, file upload or external service surface');
  await desktop.locator('#demo-case-select').selectOption('real_021');
  await desktop.locator('[data-action="start-demo"]').click();
  await desktop.locator('.case-demo-result').waitFor({ state: 'visible', timeout: 6000 });
  check(await desktop.locator('.pipeline-step.done').count() === 3, 'local case demo completes all three loading stages');
  check(await desktop.locator('#demo-dna-canvas').count() === 1 && await desktop.locator('.case-demo-result .source-panel a').count() > 0, 'local demo exposes the seven-stage DNA and public source links');
  check(await desktop.locator('#demo-dna-canvas').evaluate(canvas => { const rect = canvas.getBoundingClientRect(); return rect.width > 500 && rect.height > 400; }), 'local demo gives the interactive DNA a readable desktop stage');
  await desktop.screenshot({ path: join(artifacts, 'desktop-case-demo-result.png'), fullPage: true });

  await desktop.locator('[data-action="demo-to-canvas"]').click();
  check(await desktop.locator('.canvas-summary').isVisible(), 'predefined case demo continues into the commercial canvas');
  const nodesBefore = await desktop.locator('.flow-node').count();
  const coverageBefore = await desktop.locator('.canvas-metrics strong').first().textContent();
  await desktop.locator('[data-toggle-node="retention"]').click();
  const coverageAfter = await desktop.locator('.canvas-metrics strong').first().textContent();
  check(await desktop.locator('.flow-node').count() === nodesBefore + 1 && await desktop.locator('[data-toggle-node="retention"]').getAttribute('aria-pressed') === 'true', 'adding a canvas node updates the actual flow and selection state');
  check(coverageBefore !== coverageAfter, `canvas coverage updates after adding a node (${coverageBefore} to ${coverageAfter})`);
  check(await desktop.locator('.score-gauge strong').textContent() === '—' && (await desktop.locator('.canvas-metrics').textContent()).includes('待核算') && (await desktop.locator('.canvas-metrics').textContent()).includes('待评估'), 'sourced-case canvas keeps unverified scores, costs and risks explicitly unknown');
  await desktop.screenshot({ path: join(artifacts, 'desktop-canvas.png'), fullPage: true });
  await desktop.locator('[data-action="open-validation"]').click();
  check(await desktop.locator('.validation-answers > div').count() === 4, 'validation plan exposes four core business answers');
  check(await desktop.locator('.validation-day').count() === 7, 'validation plan creates seven daily checkpoints');
  await desktop.locator('[data-validation-day="0"]').click();
  check(await desktop.locator('.validation-day.done').count() === 1, 'validation checkpoint completion is tracked');
  await desktop.locator('[data-validation-note="0"]').fill('访谈 3 人，2 人能复述主线');
  await desktop.locator('[data-decision="continue"]').click();
  check(await desktop.locator('[data-decision="continue"]').evaluate((element) => element.classList.contains('active')), 'stage review records a continue decision');
  await desktop.locator('[data-action="save-validation"]').click();
  check(await desktop.locator('#toast').evaluate((element) => element.classList.contains('show')), 'validation progress produces save feedback');
  await desktop.screenshot({ path: join(artifacts, 'desktop-validation.png'), fullPage: true });
  await desktop.locator('[data-action="back-validation"]').click();
  await desktop.locator('[data-remove-node="retention"]').click();
  check(await desktop.locator('[data-remove-node="retention"]').count() === 0, 'canvas can remove a node');

  await desktop.locator('.side-rail [data-tab="profile"]').click();
  check(await desktop.locator('.profile-menu button').count() === 5 && await desktop.locator('[data-menu="订单与会员"]').count() === 0, 'profile removes the orders and membership menu');
  check((await desktop.locator('.identity-band').textContent()).includes('无需登录') && (await desktop.locator('.identity-band').textContent()).includes('不会自动同步'), 'profile accurately describes the device-only local workspace');
  check((await desktop.locator('.membership-band').textContent()).includes('100 个内置案例均可免费阅读全文') && (await desktop.locator('.membership-band').textContent()).includes('当前版本不展示广告'), 'profile accurately states free reading and disabled advertising');
  await desktop.locator('.membership-band [data-action="free-cases"]').click();
  check(await desktop.locator('.case-card.is-free').count() === 100 && await desktop.locator('.case-card.is-locked').count() === 0, 'profile opens all 100 free cases');
  await desktop.locator('.side-rail [data-tab="profile"]').click();
  await desktop.locator('[data-menu="我的收藏"]').click();
  check(await desktop.locator('.cases-page').isVisible() && await desktop.locator('.case-card').count() === 1 && await desktop.locator('.case-card').getAttribute('data-case-id') === 'real_001', 'profile favorites opens the actual saved-case list');
  await desktop.locator('.side-rail [data-tab="profile"]').click();
  check(await desktop.locator('#recent-cases [data-case-id="real_001"]').count() === 1 && await desktop.locator('#recent-cases [data-case-id="real_021"]').count() === 1, 'profile recent history includes old and newly free case visits');
  check(await desktop.locator('#recent-cases .signal-main').first().evaluate(element => element.getBoundingClientRect().width > 300), 'desktop recent-case titles retain a readable text column');
  await desktop.locator('[data-menu="隐私与本地数据"]').click();
  check((await desktop.locator('#toast').textContent()).includes('仅存在当前浏览器'), 'privacy menu gives honest local-storage guidance');
  check(await desktop.locator('#account-dialog, [data-action="edit-profile"], input[type="file"]').count() === 0, 'profile exposes no login, account-edit or avatar-upload surface');
  await desktop.screenshot({ path: join(artifacts, 'desktop-profile.png'), fullPage: true });

  await desktop.reload({ waitUntil: 'networkidle' });
  await desktop.locator('.side-rail [data-tab="profile"]').click();
  check(await desktop.locator('#recent-cases [data-case-id="real_021"]').count() === 1, 'case visit history survives a real browser reload');
  await desktop.locator('[data-menu="我的收藏"]').click();
  check(await desktop.locator('.case-card').count() === 1 && await desktop.locator('.case-card').getAttribute('data-case-id') === 'real_001', 'favorites survive a real browser reload');
  await desktop.locator('.side-rail [data-tab="canvas"]').click();
  check(await desktop.locator('[data-remove-node="real_021_stage_1"]').count() === 1, 'case-specific canvas content survives a real browser reload');
  await desktop.locator('[data-action="open-validation"]').click();
  check(await desktop.locator('.validation-day.done').count() === 1 && (await desktop.locator('[data-validation-note="0"]').inputValue()).includes('访谈 3 人'), 'validation completion and evidence survive a real browser reload');
  check(await desktop.locator('[data-decision="continue"]').getAttribute('class') === 'active', 'stage-review decision survives a real browser reload');

  const mobile = await browser.newPage({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1 });
  mobile.setDefaultTimeout(8000);
  captureErrors(mobile, 'mobile');
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
  await mobile.locator('#universe-canvas').waitFor({ state: 'visible' });
  await mobile.waitForTimeout(350);
  check(await mobile.locator('.bottom-nav .nav-item').count() === 5, '360x800 renders five bottom navigation tabs');
  check(await mobile.locator('.bottom-nav').isVisible(), '360x800 uses the mobile bottom navigation');
  check(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '360x800 has no document-level horizontal overflow');
  const mobilePixels = await canvasPixels(mobile, '#universe-canvas');
  check(mobilePixels.colored > 60, `mobile universe canvas contains rendered pixels (${mobilePixels.colored})`);
  await mobile.screenshot({ path: join(artifacts, 'mobile-home-360x800.png'), fullPage: true });
  await mobile.locator('.bottom-nav [data-tab="cases"]').click();
  await mobile.locator('.case-card[data-case-id="real_001"]').click();
  await mobile.locator('#dna-canvas').waitFor({ state: 'visible' });
  await mobile.waitForFunction(() => document.querySelector('#app').scrollTop === 0, null, { timeout: 2000 });
  check(await mobile.locator('.detail-header').evaluate(element => element.getBoundingClientRect().top >= 0), 'opening a case from a scrolled mobile catalog starts at the detail header');
  await mobile.waitForTimeout(350);
  await mobile.screenshot({ path: join(artifacts, 'mobile-business-brief-360x800.png') });
  await mobile.locator('#dna-canvas').scrollIntoViewIfNeeded();
  check(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile DNA detail has no document-level horizontal overflow');
  const mobileDnaPixels = await canvasPixels(mobile, '#dna-canvas');
  check(mobileDnaPixels.colored > 60, `mobile DNA canvas contains rendered pixels (${mobileDnaPixels.colored})`);
  check(await mobile.locator('.dna-stage-legend [data-stage-color]').count() === 5, 'mobile DNA retains the complete stage legend');
  await mobile.screenshot({ path: join(artifacts, 'mobile-dna-360x800.png'), fullPage: true });
  await mobile.locator('.bottom-nav [data-tab="canvas"]').click();
  await mobile.locator('[data-action="open-validation"]').click();
  check(await mobile.locator('.validation-day').count() === 7, 'mobile validation renders all seven checkpoints');
  check(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile validation has no document-level horizontal overflow');
  await mobile.screenshot({ path: join(artifacts, 'mobile-validation-360x800.png'), fullPage: true });
  await mobile.locator('.bottom-nav [data-tab="ai"]').click();
  await mobile.locator('[data-action="start-demo"]').click();
  await mobile.locator('.case-demo-result').waitFor({ state: 'visible', timeout: 6000 });
  check(await mobile.locator('textarea, input[type="file"]').count() === 0, 'mobile case demo remains predefined and upload-free');
  check(await mobile.locator('#demo-dna-canvas').evaluate(canvas => { const rect = canvas.getBoundingClientRect(); return rect.width > 300 && rect.height > 400; }), 'mobile case demo keeps a readable interactive DNA stage');
  check(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile case demo has no document-level horizontal overflow');
  await mobile.screenshot({ path: join(artifacts, 'mobile-case-demo-360x800.png'), fullPage: true });
  await mobile.locator('.bottom-nav [data-tab="profile"]').click();
  check((await mobile.locator('.identity-band').textContent()).includes('本地工作台'), 'mobile profile presents the local device workspace');
  check(await mobile.locator('#recent-cases .signal-main').first().evaluate(element => element.getBoundingClientRect().width > 220), 'mobile recent-case titles retain a readable text column');
  check(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile local-workspace profile has no document-level horizontal overflow');
  await mobile.screenshot({ path: join(artifacts, 'mobile-profile-360x800.png'), fullPage: true });

  for (const [width, height] of [[320, 760], [768, 900], [1024, 900]]) {
    const responsive = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    captureErrors(responsive, `${width}px`);
    await responsive.goto(baseUrl, { waitUntil: 'networkidle' });
    await responsive.locator('#universe-canvas').waitFor({ state: 'visible' });
    await responsive.waitForTimeout(250);
    check(await responsive.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px home has no document-level horizontal overflow`);
    check(await responsive.locator('#universe-canvas').getAttribute('data-case-count') === '100', `${width}px universe retains all 100 cases`);
    const sceneBefore = await responsive.locator('#universe-canvas').boundingBox();
    await responsive.mouse.move(sceneBefore.x + sceneBefore.width / 2, sceneBefore.y + sceneBefore.height / 2);
    await responsive.mouse.wheel(0, 600);
    await responsive.waitForTimeout(200);
    const sceneAfter = await responsive.locator('#universe-canvas').boundingBox();
    check(Math.abs(sceneBefore.y - sceneAfter.y) < 1 && await responsive.locator('#app').evaluate(element => element.scrollTop === 0), `${width}px scrolling over the planet never moves the fixed scene area`);
    await responsive.mouse.down();
    await responsive.mouse.move(sceneAfter.x + sceneAfter.width / 2 + 20, sceneAfter.y + sceneAfter.height / 2 - 50, { steps: 5 });
    await responsive.mouse.up();
    check(Math.abs((await responsive.locator('#universe-canvas').boundingBox()).y - sceneAfter.y) < 1 && await responsive.locator('.case-detail-page').count() === 0, `${width}px dragging rotates within the frame without moving it or opening a case`);
    check(sceneAfter.y >= 0 && sceneAfter.y + sceneAfter.height <= height - (width <= 720 ? 65 : 0) && sceneAfter.height > 150, `${width}px scene remains contained and usable above navigation`);
    await responsive.screenshot({ path: join(artifacts, `responsive-home-${width}.png`) });
    await responsive.locator('.nav-item:visible[data-tab="cases"]').click();
    check(await responsive.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px free catalog has no horizontal overflow`);
    check(await responsive.locator('.case-card.is-free').count() === 100 && await responsive.locator('[data-access]').count() === 0, `${width}px all cases are free and no paid filter remains`);
    await responsive.locator('.case-card').first().scrollIntoViewIfNeeded();
    await responsive.screenshot({ path: join(artifacts, `responsive-free-catalog-${width}.png`) });
    await responsive.locator('[data-case-id="real_100"]').click();
    check(await responsive.locator('#app').evaluate(element => element.scrollTop === 0), `${width}px formerly paid detail starts at the top after leaving a scrolled catalog`);
    check(await responsive.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px newly free detail has no horizontal overflow`);
    check(await responsive.locator('.transaction-story li').count() === 7, `${width}px case 100 exposes the complete readable story`);
    if (width === 320) {
      check(await responsive.locator('.locked-case-panel').count() === 0, 'small-screen newly free case has no locked presentation');
      check(await responsive.locator('.business-brief').evaluate(element => { const rect = element.getBoundingClientRect(); return rect.top >= 0 && rect.top < window.innerHeight - 70; }), '320px immediately begins with the trading explanation');
    }
    await responsive.screenshot({ path: join(artifacts, `responsive-newly-free-detail-${width}.png`) });
    await responsive.locator('[data-action="close-case"]').click();
    check(await responsive.locator('.case-card.is-free').count() === 100 && await responsive.locator('.case-card.is-locked').count() === 0, `${width}px returns to all free cases`);
    await responsive.close();
  }
} catch (error) {
  failures.push(`flow stopped: ${error.message}`);
} finally {
  await browser.close();
}

check(browserErrors.length === 0, `browser console and page errors (${browserErrors.length})`);
console.log(`\nBrowser acceptance: ${passes.length} passed, ${failures.length} failed.`);
if (browserErrors.length) browserErrors.forEach((message) => console.error(`  ERROR ${message}`));
if (failures.length) {
  failures.forEach((message) => console.error(`  FAIL  ${message}`));
  process.exitCode = 1;
} else {
  console.log('Desktop and mobile flows, 320/360/768/1024/1440 responsive screenshots, interactions, and WebGL pixel checks passed.');
}
