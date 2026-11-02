// Local simulator acceptance; preserves the pre-existing onboarding preference.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const automator = require(path.join(root, 'output/wx-automation/node_modules/miniprogram-automator'));
const out = path.join(root, 'output/onboarding-native-2026-11-02');
fs.mkdirSync(out, { recursive: true });
let app, preference, originalPage;
const timeout = setTimeout(() => { console.error('Native acceptance timed out'); process.exit(1); }, 60000);
(async () => {
  app = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9521' });
  originalPage = (await app.currentPage()).path;
  preference = await app.evaluate(() => ({ exists: wx.getStorageInfoSync().keys.includes('onboardingQuickstartV1'), value: wx.getStorageSync('onboardingQuickstartV1') }));
  console.log('Connected to simulator');
  const profile = await app.switchTab('/pages/profile/profile');
  assert.ok((await profile.data('menus')).some(item => item.id === 'onboarding'));
  const guide = await app.navigateTo('/onboarding/pages/guide/guide?entry=profile');
  await guide.waitFor(1500);
  const state = await guide.data();
  assert.equal(state.videoError, false, 'Packaged video read and local copy succeed');
  assert.ok(state.videoSrc && !state.videoLoading, 'Player receives local video');
  const info = await app.callWxMethod('getVideoInfo', { src: state.videoSrc });
  assert.equal(info.width, 540);
  assert.equal(info.height, 960);
  assert.ok(Math.abs(info.duration - 32) < 0.5);
  await app.screenshot({ path: path.join(out, 'guide.png') });
  await app.evaluate(() => wx.createVideoContext('quickstart-video', getCurrentPages().slice(-1)[0]).play());
  await guide.waitFor(1800);
  await app.screenshot({ path: path.join(out, 'playing.png') });
  await guide.callMethod('leaveGuide');
  assert.equal((await app.currentPage()).path, 'pages/profile/profile');
  const replay = await app.navigateTo('/onboarding/pages/guide/guide?entry=profile');
  await replay.waitFor(800);
  assert.ok(await replay.data('videoSrc'), 'Replay loads video');
  await replay.callMethod('leaveGuide');
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ version: '0.1', last_updated: '2026-11-02', passed: true, video: info, checks: ['profile replay entry', 'packaged video readable', 'local video metadata', 'player play requested and screenshot', 'return to profile', 'replay loads'] }, null, 2));
  console.log('Native guide acceptance passed');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (app && preference) {
    try {
      await app.evaluate(saved => { if (saved.exists) wx.setStorageSync('onboardingQuickstartV1', saved.value); else wx.removeStorageSync('onboardingQuickstartV1'); }, preference);
    } catch (error) { console.error('Preference restore failed'); process.exitCode = 1; }
  }
  if (app) await app.disconnect();
  clearTimeout(timeout);
});
