// Run with playwright-cli run-code --filename scripts/check-practice-feedback-ui.js
// This operates only on the independent next-version preview and restores
// its two storage keys, including any drafts present before the check.
async (page) => {
  const url = 'http://127.0.0.1:4173/preview/practice-feedback/';
  const draftKey = 'qingchuang:practice-feedback:v1';
  const favoriteKey = 'qingchuang.practice-feedback.favorites.v1';
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on('pageerror', onError);
  await page.goto(url);
  await page.locator('.case-card').first().waitFor();
  const baseline = await page.evaluate((keys) => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), [draftKey, favoriteKey]);
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const recordName = '为Easlo：把任务管理经验做成 Notion 模板写实践记录';
  const detailName = '查看案例：Easlo：把任务管理经验做成 Notion 模板';
  let detailsRoute;
  try {
    assert(await page.locator('.case-card').count() === 100, 'Real case index did not render 100 entries');
    const detailLoadedEarly = await page.evaluate(() => performance.getEntriesByType('resource').some(item => item.name.endsWith('/preview/case-library.js')));
    assert(!detailLoadedEarly, 'Full case details were loaded before opening a case');

    await page.getByRole('searchbox', { name: '搜索案例、行业或关键词' }).fill('Easlo');
    assert(await page.locator('.case-card').count() === 1, 'Case search did not narrow the list');
    await page.getByRole('button', { name: recordName, exact: true }).click();
    await page.getByRole('button', { name: '保存本机草稿', exact: true }).click();
    assert(await page.locator('[aria-invalid=true]').count() >= 5, 'Incomplete evidence record was accepted');
    await page.getByRole('radio', { name: '未达预期', exact: true }).check();
    const values = {
      '做了什么必填': '验收样例（非真实实践）：向三位测试人员展示原创模板。',
      '实践时间与周期必填': '验收样例：2026-10-14，共一天',
      '你的条件与限制必填': '仅用于界面验收，参与者三人，不代表真实用户或经营结果。',
      '具体结果必填': '验收样例：未达预期；本段不是真实实践反馈。',
      '支持结果的证据必填': '验收样例：只支持界面保存流程通过，不证明案例效果。'
    };
    for (const [label, value] of Object.entries(values)) await page.getByRole('textbox', { name: label, exact: true }).fill(value);
    await page.getByRole('textbox', { name: '可选公开证据链接', exact: true }).fill('javascript:alert(1)');
    await page.getByRole('button', { name: '保存本机草稿', exact: true }).click();
    assert(await page.locator('[aria-invalid=true]').count() >= 1, 'Unsafe evidence URL was accepted');
    await page.getByRole('textbox', { name: '可选公开证据链接', exact: true }).fill('https://www.easlo.co/templates');
    await page.getByRole('button', { name: '保存本机草稿', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /我的记录/ }).click();
    assert(await page.getByText('验收样例：未达预期；本段不是真实实践反馈。', { exact: true }).count() === 1, 'Saved result is missing');
    await page.reload();
    await page.getByRole('button', { name: /我的记录/ }).click();
    const testCard = page.locator('.draft-card').filter({ hasText: '验收样例：未达预期' });
    assert(await testCard.count() === 1, 'Draft did not recover after reload');
    await testCard.getByRole('button', { name: '继续编辑', exact: true }).click();
    assert(await page.getByRole('radio', { name: '未达预期', exact: true }).isChecked(), 'Failed outcome changed on recovery');
    await page.getByRole('textbox', { name: '补充说明 / 问题', exact: true }).fill('验收样例编辑：<img src=x onerror=alert(1)> 作为文字保存。');
    await page.getByRole('button', { name: '保存本机草稿', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });
    await testCard.getByRole('button', { name: '复制摘要', exact: true }).click();
    await page.getByText('摘要已复制，包含“本机草稿”说明。', { exact: true }).waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert(copied.includes('验收样例') && copied.includes('未在平台公开发布') && copied.includes('未经独立核验'), 'Copied summary overstates verification or publication');
    // The CLI suspends a code batch at native dialogs. The genuine confirmation
    // was inspected separately; intercept only this known prompt for this batch.
    await page.evaluate(() => {
      window.__practiceQaConfirm = window.confirm;
      window.__practiceQaDeleteConfirmed = false;
      window.confirm = message => {
        window.__practiceQaDeleteConfirmed = message === '删除这条本机草稿？删除后无法恢复。';
        return window.__practiceQaDeleteConfirmed;
      };
    });
    await testCard.getByRole('button', { name: '删除', exact: true }).click();
    assert(await page.evaluate(() => window.__practiceQaDeleteConfirmed), 'Delete action skipped confirmation');
    await page.evaluate(() => { window.confirm = window.__practiceQaConfirm; delete window.__practiceQaConfirm; delete window.__practiceQaDeleteConfirmed; });
    assert(await page.locator('.draft-card').filter({ hasText: '验收样例：未达预期' }).count() === 0, 'Deleted draft remains visible');

    await page.goto(url);
    await page.getByRole('searchbox', { name: '搜索案例、行业或关键词' }).fill('Easlo');
    const favorite = page.getByRole('button', { name: /^收藏：Easlo/ });
    if (await favorite.count()) await favorite.click();
    await page.getByRole('button', { name: '已收藏', exact: true }).click();
    assert(await page.locator('.case-card').count() === 1, 'Favorite filter does not show the saved case');
    await page.getByRole('button', { name: '全部案例', exact: true }).click();
    await page.getByRole('searchbox', { name: '搜索案例、行业或关键词' }).fill('完全没有匹配的验收关键词');
    assert(await page.getByRole('heading', { name: '暂时没有匹配的案例' }).isVisible(), 'Search empty state is missing');
    await page.getByRole('button', { name: '清除筛选', exact: true }).click();

    // A network error must leave a usable summary and permit a real retry.
    detailsRoute = route => route.abort();
    await page.route('**/preview/case-library.js', detailsRoute);
    await page.getByRole('button', { name: detailName, exact: true }).click();
    await page.getByText('详情加载失败。你仍可查看案例简介，或先写本机实践记录。', { exact: true }).waitFor();
    await page.unroute('**/preview/case-library.js', detailsRoute);
    detailsRoute = null;
    await page.getByRole('button', { name: '重新加载详情', exact: true }).click();
    await page.getByRole('heading', { name: '七个阶段，看清做法', exact: true }).waitFor();
    await page.locator('.source-details > summary').click();
    assert(await page.locator('.source-details a[href="https://www.easlo.co/templates"]').isVisible(), 'Real public source is not accessible');
    assert(await page.getByText('当前还没有公开投稿', { exact: true }).isVisible(), 'Public feedback was populated with local drafts');
    await page.getByRole('button', { name: '写问题 / 评论草稿', exact: true }).click();
    await page.getByRole('textbox', { name: '问题或评论正文必填', exact: true }).fill('验收样例问题：已有免费替代方案时应如何比较？');
    await page.getByRole('button', { name: '保存本机草稿', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /我的记录/ }).click();
    assert(await page.locator('#draft-list').getByText('验收样例问题：已有免费替代方案时应如何比较？', { exact: true }).isVisible(), 'Question draft was not saved');
    assert(await page.locator('#draft-list .outcome-label').count() === 0, 'Question was counted as a practice result');

    // Restore the preview's exact original keys before screenshots.
    await page.evaluate((entries) => { for (const [key, value] of Object.entries(entries)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } }, baseline);
    await page.goto(url);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert(!overflow, `Horizontal overflow at ${width}px`);
      assert(await page.getByText('本机记录 · 暂未公开，共享评论尚未接通', { exact: true }).isVisible(), `Preview scope hidden at ${width}px`);
      if (width === 390 || width === 1440) await page.screenshot({ path: `output/playwright/practice-feedback-${width}.png`, fullPage: false });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: detailName, exact: true }).click();
    await page.getByRole('heading', { name: '七个阶段，看清做法', exact: true }).waitFor();
    await page.screenshot({ path: 'output/playwright/practice-feedback-case-390.png' });
    await page.keyboard.press('Escape');
    assert(await page.getByRole('button', { name: detailName, exact: true }).evaluate(element => element === document.activeElement), 'Dialog did not restore keyboard focus');
    await page.getByRole('button', { name: recordName, exact: true }).click();
    for (let step = 0; step < 20; step++) {
      await page.keyboard.press('Tab');
      assert(await page.evaluate(() => Boolean(document.activeElement.closest('dialog'))), 'Keyboard focus escaped the open dialog');
    }
    await page.locator('.dialog-body').evaluate(element => element.scrollTop = 0);
    await page.getByRole('heading', { name: '记录一次真实尝试', exact: true }).focus();
    await page.screenshot({ path: 'output/playwright/practice-feedback-form-390.png' });
    await page.keyboard.press('Escape');
    assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
    return { passed: true, checks: 'real search/favorites, evidence validation, save/reload/edit/copy/delete, question separation, lazy details/retry, public empty state, 320/390/768/1024/1440 layout, keyboard focus', pageErrors: errors };
  } finally {
    if (detailsRoute) await page.unroute('**/preview/case-library.js', detailsRoute);
    await page.evaluate((entries) => { for (const [key, value] of Object.entries(entries)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } }, baseline);
    await page.evaluate(() => { if (window.__practiceQaConfirm) window.confirm = window.__practiceQaConfirm; delete window.__practiceQaConfirm; delete window.__practiceQaDeleteConfirmed; });
    page.off('pageerror', onError);
  }
}
