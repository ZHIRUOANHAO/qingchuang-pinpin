async (page) => {
  let checks = 0;
  const assert = (condition, message) => { if (!condition) throw new Error(message); checks++; };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/preview/');
  await page.setViewportSize({ width: 360, height: 780 });
  const canvas = page.locator('#universe-canvas');
  const pause = page.locator('[data-universe-control="pause"]');
  const reset = page.locator('[data-universe-control="reset"]');
  await canvas.waitFor();
  await pause.click();
  assert(await pause.getAttribute('aria-pressed') === 'true', 'pause is exposed to assistive technology');
  assert(await canvas.getAttribute('data-motion-state') === 'paused', 'pause reaches the renderer');
  const frozen = await canvas.evaluate(node => node.toDataURL());
  await page.waitForTimeout(250);
  assert(frozen === await canvas.evaluate(node => node.toDataURL()), 'paused canvas is pixel-stable');
  for (const button of [pause, reset]) {
    const bounds = await button.boundingBox();
    assert(bounds.width >= 44 && bounds.height >= 44, 'controls have usable touch targets');
  }
  await pause.click();
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .65, bounds.y + bounds.height * .53, { steps: 5 });
  await page.waitForTimeout(40);
  assert(await canvas.getAttribute('data-motion-state') === 'dragging', 'drag holds flight');
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert(await canvas.getAttribute('data-motion-state') === 'settling', 'release does not immediately resume');
  await page.waitForTimeout(1050);
  assert(await canvas.getAttribute('data-motion-state') === 'running', 'flight resumes gently after release');
  await reset.click();
  assert(await canvas.getAttribute('data-case-count') === '100', 'all 100 cases are still available');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '360px has no horizontal overflow');
  await page.screenshot({ path: 'output/playwright/orbit-home-mobile-2026-10-24.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await pause.waitFor();
  assert(await pause.isDisabled(), 'reduced motion cannot be overridden by continue');
  assert(await canvas.getAttribute('data-motion-state') === 'reduced', 'reduced motion reaches renderer');
  assert(errors.length === 0, `no browser script errors: ${errors.join('; ')}`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  return { passed: true, checks, viewport: '360×780', errors };
}
