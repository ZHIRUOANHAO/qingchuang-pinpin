import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(join(root, path), 'utf8');
const appConfig = JSON.parse(read('miniprogram/app.json'));
const projectConfig = JSON.parse(read('project.config.json'));
const privateConfig = JSON.parse(read('project.private.config.json'));
const { env } = require('../miniprogram/config/env');
const ads = require('../miniprogram/config/ads');

const blockers = [];
const passes = [];
const check = (condition, pass, blocker) => (condition ? passes.push(pass) : blockers.push(blocker));
const validEmail = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/@example\.(com|org|net)$/i.test(value);

check(projectConfig.appid && projectConfig.appid !== 'wx2f9d25ee643ab824', '已配置正式 AppID', '仍在使用测试 AppID；请注册正式小程序后替换 project.config.json 的 appid');
check(validEmail(env.supportEmail), '已配置真实联系邮箱', '缺少真实联系邮箱；请填写 miniprogram/config/env.js 的 supportEmail');
check(env.cloudEnabled === false && env.runtimeMode === 'local_case_library', '运行模式为纯本地案例库', '发布版运行模式必须明确为 local_case_library 且 cloudEnabled=false');
check(projectConfig.libVersion === privateConfig.libVersion, `基础库版本已固定为 ${projectConfig.libVersion}`, 'project.config.json 与 project.private.config.json 的基础库版本不一致');
check(ads.enabled === false && Object.values(ads.slots).every(slot => !slot.unitId), '广告保持禁用且无广告位 ID', '流量主未开通前必须保持广告禁用且 unitId 为空');

const blockedRoutes = ['pages/login/login', 'pages/account/account', 'pages/membership/membership', 'pages/orders/orders'];
check(blockedRoutes.every(route => !appConfig.pages.includes(route)), '登录、会员和订单页不在发布路由', '发布路由仍包含登录、会员或订单页');
check(appConfig.tabBar?.list?.some(item => item.pagePath === 'pages/ai/ai' && item.text === '案例演示'), '第三个 Tab 明确为案例演示', '第三个 Tab 仍可能误导为 AI 功能');
check(['pages/privacy/privacy', 'pages/agreement/agreement', 'pages/minors/minors'].every(route => appConfig.pages.includes(route)), '三份合规说明均已注册', '隐私、用户协议或未成年人保护页面缺失');

const activeFiles = ['miniprogram/app.js'];
for (const route of appConfig.pages) {
  for (const extension of ['.js', '.wxml']) {
    const path = `miniprogram/${route}${extension}`;
    if (existsSync(join(root, path))) activeFiles.push(path);
  }
}
for (const directory of ['miniprogram/components', 'miniprogram/config', 'miniprogram/utils']) {
  const walk = path => readdirSync(join(root, path), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(path, entry.name)) : [join(path, entry.name)]);
  activeFiles.push(...walk(directory).filter(path => /\.(js|wxml)$/.test(path)));
}
const activeSource = activeFiles.map(path => `${path}\n${read(path)}`).join('\n');
check(!/services\/(ai|payment|auth)/.test(activeSource), '发布页面未引用 AI、支付或云登录服务', '发布页面仍引用 AI、支付或云登录服务');
check(!/wx\.(request|uploadFile)|wx\.cloud\.callFunction/.test(activeSource), '发布页面无外部请求和云函数调用', '发布页面仍存在外部请求、上传或云函数调用');
check(!/getSystemInfoSync/.test(activeSource), '发布代码未使用已废弃 getSystemInfoSync', '发布代码仍使用已废弃 getSystemInfoSync');
check(!/(稳赚|暴利|轻松月入|保证变现|稳赚不赔|躺赚)/.test(activeSource), '发布界面未发现收益承诺词', '发布界面存在需删除的收益承诺词');

console.log(`Release preflight: ${passes.length} passed, ${blockers.length} blocked.`);
passes.forEach(message => console.log(`  PASS  ${message}`));
blockers.forEach(message => console.error(`  BLOCK ${message}`));
if (blockers.length) process.exitCode = 1;
