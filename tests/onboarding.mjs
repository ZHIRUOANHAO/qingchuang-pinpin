import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const read = file => fs.readFileSync(new URL(`../miniprogram/${file}`, import.meta.url), 'utf8');
function harness({ accepted = true, deniedStorage = false, saved = '', navigateFail = false } = {}) {
  const store = new Map([['onboardingQuickstartV1', saved]]);
  const app = { globalData: { privacyAccepted: accepted, reducedMotion: false } };
  const calls = [];
  const files = {
    readFile(options) { calls.push(['read', options.filePath]); this.pendingRead = options },
    writeFile(options) { calls.push(['write', options.filePath]); this.pendingWrite = options }
  };
  const wx = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager: () => files,
    getStorageSync(key) { if (deniedStorage) throw Error('denied'); return store.get(key) || '' },
    setStorageSync(key, value) { if (deniedStorage) throw Error('denied'); store.set(key, value) },
    navigateTo(options) { calls.push(['navigateTo', options.url]); (navigateFail ? options.fail : options.success)?.(); options.complete?.() },
    navigateBack(options) { calls.push(['back']); options.fail?.() },
    switchTab(options) { calls.push(['switchTab', options.url]) },
    showToast(options) { calls.push(['toast', options.title]) },
    createVideoContext() { return { pause() { calls.push(['pause']) } } }
  };
  const serviceModule = { exports: {} };
  vm.runInNewContext(read('services/onboarding.js'), { module: serviceModule, wx });
  const service = serviceModule.exports;
  function load(file) {
    let definition;
    vm.runInNewContext(read(file), {
      Page(value) { definition = value }, wx, getApp: () => app, setTimeout,
      require(name) {
        if (name.endsWith('/services/onboarding')) return service;
        if (file.startsWith('pages/home/')) return require(`../miniprogram/pages/home/${name}`);
        return {};
      }
    });
    const page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)), setData(update, done) { Object.assign(this.data, update); done?.() } };
    return page;
  }
  return { service, app, store, calls, files, load };
}

test('first offer waits for privacy acceptance and decline never opens it', () => {
  const h = harness({ accepted: false });
  const page = h.load('pages/home/home.js');
  page.onLoad(); page.onShow();
  assert.equal(page.data.showPrivacy, true);
  assert.equal(page.data.showOnboarding, false);
  page.declinePrivacy(); page.onShow();
  assert.equal(page.data.showOnboarding, false);
  h.app.globalData.privacyAccepted = true;
  page.acceptPrivacy();
  assert.equal(page.data.showPrivacy, false);
  assert.equal(page.data.showOnboarding, true);
});

test('skip is remembered even when storage is unavailable in the current session', () => {
  const h = harness({ deniedStorage: true });
  const page = h.load('pages/home/home.js');
  page.onLoad(); page.onShow(); assert.equal(page.data.showOnboarding, true);
  page.skipOnboarding(); page.onHide(); page.onShow();
  assert.equal(page.data.showOnboarding, false);
  assert.equal(page.data.pageHidden, false);
});

test('valid saved dismissal suppresses offer, corrupt values do not', () => {
  assert.equal(harness({ saved: { version: 1, status: 'skipped' } }).service.shouldOffer(), false);
  assert.equal(harness({ saved: true }).service.shouldOffer(), true);
  assert.equal(harness({ saved: { version: 1, status: 'unknown' } }).service.shouldOffer(), true);
});

test('failed navigation preserves offer; successful opening dismisses and page lifecycle restores coverage', () => {
  const failed = harness({ navigateFail: true });
  const bad = failed.load('pages/home/home.js'); bad.onLoad(); bad.onShow(); bad.watchOnboarding();
  assert.equal(bad.data.showOnboarding, true); assert.equal(failed.service.shouldOffer(), true);
  const h = harness(); const page = h.load('pages/home/home.js');
  page.onLoad(); page.onShow(); page.watchOnboarding(); page.onHide();
  assert.equal(page.data.pageHidden, true);
  page.onShow(); assert.equal(page.data.showOnboarding, false); assert.equal(page.data.pageHidden, false);
  assert.match(read('pages/home/home.wxml'), /covered="{{showPrivacy \|\| showOnboarding \|\| pageHidden}}"/);
});

test('subpackage video copies to playable local path, not a network URL', () => {
  const h = harness(); const page = h.load('onboarding/pages/guide/guide.js'); page.onLoad();
  assert.equal(page.data.videoLoading, true);
  h.files.pendingRead.success({ data: new ArrayBuffer(4) });
  h.files.pendingWrite.success();
  assert.equal(page.data.videoSrc, 'wxfile://usr/qcpp-onboarding-quickstart-v1.mp4');
  assert.equal(page.data.videoLoading, false);
  page.videoEnded(); assert.equal(page.data.completed, true);
  assert.equal(h.store.get('onboardingQuickstartV1').status, 'completed');
});

test('video read failure retains four steps and retry ignores obsolete async callbacks', () => {
  const h = harness(); const page = h.load('onboarding/pages/guide/guide.js'); page.onLoad();
  const previous = h.files.pendingRead;
  previous.fail(); assert.equal(page.data.videoError, true); assert.equal(page.data.steps.length, 4);
  page.retryVideo(); previous.success({ data: new ArrayBuffer(4) });
  assert.equal(h.files.pendingWrite, undefined);
  h.files.pendingRead.success({ data: new ArrayBuffer(4) });
  page.onUnload(); h.files.pendingWrite.success();
  assert.equal(page.data.videoSrc, '');
  assert.ok(h.calls.some(call => call[0] === 'pause'));
});

test('start uses starter filter and returns work to existing cases; guide skip has home fallback', () => {
  const h = harness(); const page = h.load('onboarding/pages/guide/guide.js'); page.onLoad();
  page.startCases(); assert.equal(h.store.get('caseAccess'), 'starter');
  assert.ok(h.calls.some(call => call[0] === 'switchTab' && call[1] === '/pages/cases/cases'));
  page.leaveGuide(); assert.ok(h.calls.some(call => call[0] === 'switchTab' && call[1] === '/pages/home/home'));
  assert.equal(h.store.has('activeWorkflow'), false);
});

test('video route is a separate package with replay entry and manual controls', () => {
  const config = JSON.parse(read('app.json'));
  assert.ok(config.subPackages.some(p => p.root === 'onboarding' && p.pages.includes('pages/guide/guide')));
  assert.match(read('pages/profile/profile.js'), /name: '新手引导'.*\/onboarding\/pages\/guide\/guide/);
  const markup = read('onboarding/pages/guide/guide.wxml');
  assert.match(markup, /autoplay="{{false}}"/); assert.match(markup, /controls="{{true}}"/);
  assert.match(markup, /binderror="videoFailed"/); assert.match(markup, /bindtap="leaveGuide"/);
});
