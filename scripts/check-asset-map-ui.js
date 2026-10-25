async (page) => {
  let checks = 0;
  const assert = (condition, message) => { if (!condition) throw Error(message); checks++; };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/preview/');
  await page.getByRole('button', { name: '打开一个完整案例', exact: true }).click();
  const map = page.locator('[data-asset-map="case"]');
  assert(await map.locator('button[data-node-id]').count() === 7, 'all seven stage cards are connected');
  await page.setViewportSize({ width: 1280, height: 1700 });
  await map.scrollIntoViewIfNeeded();
  const geometry = await map.evaluate(element => [...element.querySelectorAll('.connected-map-branch')].map(branch => {
    const wire = branch.querySelector('.connected-map-wire').getBoundingClientRect();
    const card = branch.querySelector('.connected-map-card').getBoundingClientRect();
    return { gap: Math.abs(wire.right - card.left), relativeY: wire.top - card.top };
  }));
  assert(geometry.every(item => item.gap <= 2), 'desktop wires end at each real card edge');
  await map.screenshot({ path: 'output/playwright/asset-map-case-2026-10-24.png' });
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await map.scrollIntoViewIfNeeded();
    assert(await map.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${width}px map has no horizontal overflow`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px page has no horizontal overflow`);
    const aligned = await map.evaluate(element => [...element.querySelectorAll('.connected-map-branch')].every(branch => {
      const wire = branch.querySelector('.connected-map-wire').getBoundingClientRect();
      const card = branch.querySelector('.connected-map-card').getBoundingClientRect();
      return Math.abs(wire.right - card.left) <= 2;
    }));
    assert(aligned, `${width}px scrolling layout keeps all wires attached`);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  const first = map.locator('button[data-node-id]').first();
  await first.focus();
  await page.keyboard.press('Enter');
  const sheet = page.locator('.node-sheet');
  await sheet.waitFor({ state: 'visible' });
  const detail = sheet.locator('[data-asset-map="node"]');
  assert(await detail.locator('.connected-map-branch').count() >= 7, 'stage detail contains the actual goal, method, assets and risk branches');
  assert(await detail.locator('.connected-map-items li').count() > 0, 'concrete assets remain visible as connected child entries');
  assert(await sheet.evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'mobile sheet wraps long asset content');
  await page.waitForTimeout(230);
  await page.screenshot({ path: 'output/playwright/asset-map-detail-mobile-2026-10-24.png' });
  const save = sheet.locator('[data-save-stage]');
  if ((await save.textContent()).includes('已保存')) await save.click();
  await save.click();
  assert((await save.textContent()).includes('已保存'), 'asset stage still saves successfully');
  await sheet.locator('[data-action="close-node"]').click();
  assert(await page.locator('.node-sheet').count() === 0, 'asset sheet closes normally');
  assert(errors.length === 0, `no browser script errors: ${errors.join('; ')}`);
  return { passed: true, checks, errors };
}
