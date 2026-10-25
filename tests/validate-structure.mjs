import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(testsDir, '..');
const failures = [];
const passes = [];

function check(condition, message) {
  if (condition) passes.push(message);
  else failures.push(message);
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && ['node_modules', 'miniprogram_npm', '.git', 'videos', 'output', '项目资料'].includes(entry.name)) return [];
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const requiredFiles = [
  'package.json',
  'project.config.json',
  'sitemap.json',
  'miniprogram/app.js',
  'miniprogram/app.json',
  'miniprogram/app.wxss',
  'miniprogram/data/cases.js',
  'miniprogram/data/case-summaries.js',
  'miniprogram/data/case-catalog.js',
  'miniprogram/data/case-free-details.js',
  'miniprogram/data/case-library-meta.js',
  'miniprogram/data/modules.js',
  'miniprogram/utils/validation.js',
  'miniprogram/config/business-stages.js',
  'miniprogram/config/ads.js',
  'miniprogram/config/dna-theme.js',
  'miniprogram/utils/dna-renderer.js',
  'preview/dna-theme.js',
  'miniprogram/components/ad-slot/ad-slot.js',
  'miniprogram/components/ad-slot/ad-slot.json',
  'miniprogram/components/ad-slot/ad-slot.wxml',
  'miniprogram/components/ad-slot/ad-slot.wxss',
  'miniprogram/pages/privacy/privacy.wxml',
  'miniprogram/pages/agreement/agreement.wxml',
  'miniprogram/pages/minors/minors.wxml',
  'miniprogram/pages/validation/validation.js',
  'miniprogram/pages/validation/validation.json',
  'miniprogram/pages/validation/validation.wxml',
  'miniprogram/pages/validation/validation.wxss',
  'preview/index.html',
  'preview/styles.css',
  'preview/app.js',
  'preview/data.js',
  'preview/case-library.js',
  'preview/favicon.svg',
  'preview/scene.js',
  'preview/vendor/three.module.js',
  'preview/vendor/three.core.js',
  'scripts/serve-preview.mjs',
  'scripts/import-case-library.mjs',
  'scripts/release-preflight.mjs',
  'tests/validate-structure.mjs',
  'tests/browser-acceptance.mjs',
];

requiredFiles.forEach((path) => check(existsSync(join(root, path)), `required file: ${path}`));

const jsonFiles = walk(root).filter((path) => extname(path) === '.json');
jsonFiles.forEach((path) => {
  const label = relative(root, path).replaceAll('\\', '/');
  try {
    JSON.parse(readFileSync(path, 'utf8'));
    passes.push(`valid JSON: ${label}`);
  } catch (error) {
    failures.push(`valid JSON: ${label} (${error.message})`);
  }
});

if (existsSync(join(root, 'miniprogram/app.json'))) {
  const appConfig = JSON.parse(read('miniprogram/app.json'));
  check(Array.isArray(appConfig.pages) && appConfig.pages.length >= 5, 'app.json declares at least five pages');
  check(appConfig.tabBar?.list?.length === 5, 'app.json declares exactly five tab items');
  check(appConfig.tabBar?.list?.some(item => item.pagePath === 'pages/ai/ai' && item.text === '案例演示'), 'third tab is honestly labelled as a predefined case demo');
  check(['pages/login/login', 'pages/account/account', 'pages/membership/membership', 'pages/orders/orders'].every(page => !appConfig.pages.includes(page)), 'release routes exclude login, membership, orders and payment surfaces');
  check(['pages/privacy/privacy', 'pages/agreement/agreement', 'pages/minors/minors'].every(page => appConfig.pages.includes(page)), 'release routes include privacy, terms and minors notices');
  check(appConfig.usingComponents?.['ad-slot'] === '/components/ad-slot/ad-slot', 'app.json registers the reusable ad slot');
  for (const page of appConfig.pages || []) {
    const base = join(root, 'miniprogram', page);
    for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
      check(existsSync(`${base}${extension}`), `page artifact: ${page}${extension}`);
    }
  }
}

if (existsSync(join(root, 'miniprogram/config/ads.js'))) {
  const adsCode = read('miniprogram/config/ads.js');
  const aiCode = read('miniprogram/pages/ai/ai.js');
  const aiView = read('miniprogram/pages/ai/ai.wxml');
  const adViews = [
    'miniprogram/pages/home/home.wxml',
    'miniprogram/pages/cases/cases.wxml',
    'miniprogram/pages/ai/ai.wxml',
    'miniprogram/pages/profile/profile.wxml',
  ].map(read).join('\n');
  check(adsCode.includes('const enabled = false'), 'advertising is disabled by default');
  check((adViews.match(/<ad-slot/g) || []).length === 2, 'disabled advertising placeholders stay outside the case demo and profile');
  check(!aiCode.includes("services/ai") && !/chooseMessageFile|wx\.request|wx\.uploadFile|wx\.cloud/.test(aiCode), 'case demo has no AI, upload or network integration');
  check(aiView.includes('全部内容已预置在安装包内') && !/<textarea|chooseFile|外部模型/.test(aiView.replace('不调用外部模型', '')), 'case demo only accepts predefined local cases');
}

if (existsSync(join(root, 'preview/index.html')) && existsSync(join(root, 'preview/app.js'))) {
  const html = read('preview/index.html');
  const appCode = read('preview/app.js');
  const sceneCode = read('preview/scene.js');
  const styles = read('preview/styles.css');
  check(html.includes('type="importmap"'), 'preview uses an ESM import map');
  check(html.includes('./vendor/three.module.js'), 'Three.js resolves through the local ESM import map');
  check(!/https?:\/\//.test(html), 'preview HTML has no external network dependency');
  check((appCode.match(/id: '(home|cases|ai|canvas|profile)'/g) || []).length === 5, 'preview defines five primary tabs');
  check(appCode.includes('createUniverse') && appCode.includes('createDnaScene'), 'preview initializes both Three.js scenes');
  check(appCode.includes('一门生意如何运转') && appCode.includes('普通人 · 低成本起步优先') && appCode.includes('最后交付什么，钱怎么收'), 'preview centers a concrete transaction, delivery and collection rather than earnings claims');
  check(sceneCode.includes('Raycaster') && sceneCode.includes("addEventListener('wheel'"), 'DNA scene supports node picking and zoom');
  check(sceneCode.includes('buildDna(THREE, nodes)') && sceneCode.includes('theme.lighting') && read('preview/dna-theme.js').includes('../miniprogram/config/dna-theme.js'), 'web DNA uses the shared stage palette and renderer');
  check(appCode.includes('data-toggle-node') && appCode.includes('canvasScore'), 'canvas supports node changes and score updates');
  check(appCode.includes('renderCaseDemo') && appCode.includes('startCaseDemo') && appCode.includes("demoStatus = 'done'") && !appCode.includes('startAi'), 'preview replaces the simulated AI flow with a predefined local case demo');
  check(styles.includes('@media (max-width: 720px)') && styles.includes('@media (max-width: 380px)'), 'preview includes mobile responsive rules');
  check(styles.includes('.side-rail') && styles.includes('.bottom-nav'), 'preview includes desktop and mobile navigation');
}

if (existsSync(join(root, 'miniprogram/components/space-scene/space-scene.js'))) {
  const appCode = read('miniprogram/app.js');
  const miniScene = read('miniprogram/components/space-scene/space-scene.js');
  check(!`${appCode}\n${miniScene}\n${read('miniprogram/components/dna-mini/dna-mini.js')}\n${read('miniprogram/components/galaxy-backdrop/galaxy-backdrop.js')}`.includes('getSystemInfoSync'), 'active rendering code avoids deprecated getSystemInfoSync');
  check(miniScene.includes("require('../../utils/dna-renderer')") && miniScene.includes('applyDnaSelection') && miniScene.includes('resetView'), 'mini program DNA uses shared geometry, selection feedback and view reset');
}

if (existsSync(join(root, 'miniprogram/utils/validation.js'))) {
  const validationCode = read('miniprogram/utils/validation.js');
  const canvasCode = read('miniprogram/pages/canvas/canvas.js');
  const validationView = read('miniprogram/pages/validation/validation.wxml');
  const recordsCode = read('miniprogram/pages/records/records.js');
  const schemesCode = read('miniprogram/pages/schemes/schemes.js');
  check(validationCode.includes('buildValidationPlan') && validationCode.includes('planProgress'), 'validation utility builds plans and tracks progress');
  check(canvasCode.includes("storage.write('activeWorkflow'") && canvasCode.includes('openValidation'), 'canvas persists workflow context and opens validation');
  check(validationView.includes('7 天验证关卡') && validationView.includes('阶段复盘'), 'validation page includes execution and review stages');
  check(recordsCode.includes("sourceType: 'demo'") && recordsCode.includes('continueCanvas') && recordsCode.includes('openValidation'), 'case-demo history can resume canvas and validation');
  check(schemesCode.includes('schemeId') && schemesCode.includes('openValidation'), 'saved schemes preserve identity and validation access');
}

const packageJson = JSON.parse(read('package.json'));
check(Boolean(packageJson.devDependencies?.three), 'root package declares Three.js');
const defaultTest = packageJson.scripts?.test || '';
check(['tests/validate-structure.mjs', 'tests/case-library.mjs', 'tests/experience.mjs'].every(file => defaultTest.includes(file)), 'root test script covers structure, case isolation and experience logic');
check(packageJson.scripts?.['sync:cases'] === 'node scripts/import-case-library.mjs', 'root package exposes the canonical case-library import');

console.log(`\nStructure validation: ${passes.length} passed, ${failures.length} failed.`);
if (failures.length) {
  failures.forEach((message) => console.error(`  FAIL  ${message}`));
  process.exitCode = 1;
} else {
  console.log('All required project, JSON, preview, and interaction checks passed.');
}
