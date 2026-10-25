#!/usr/bin/env node
/**
 * 轻创拼拼 · 上线信息一键回填
 *
 * 用法（在项目根目录执行）：
 *   node scripts/set-release-info.mjs --show
 *   node scripts/set-release-info.mjs --entity "张三（个人开发者）" --icp "京ICP备2024xxxxxx号-1X" --email "hi@example.cn"
 *
 * 只修改 miniprogram/config/env.js 的三个发布字段：entityName / icpNumber / supportEmail。
 * 填写后请重新运行：node scripts/release-preflight.mjs 与 npm test
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const envPath = resolve(root, 'miniprogram/config/env.js');

const args = process.argv.slice(2);
const get = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1].trim() : '';
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ICP = /ICP备\d+号/;

function readEnvFields() {
  const source = readFileSync(envPath, 'utf8');
  const field = (name) => {
    const match = source.match(new RegExp(name + ":\\s*'((?:[^'\\\\]|\\\\.)*)'"));
    return match ? match[1].replace(/\\\\(.)/g, '$1') : '';
  };
  return { source, entityName: field('entityName'), icpNumber: field('icpNumber'), supportEmail: field('supportEmail') };
}

function quote(value) {
  return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function applyField(source, name, value) {
  const pattern = new RegExp('(' + name + ":\\s*)'(?:[^'\\\\]|\\\\.)*'");
  if (!pattern.test(source)) throw new Error('env.js 中找不到字段 ' + name);
  return source.replace(pattern, "$1" + quote(value));
}

const current = readEnvFields();
if (!args.length || args.includes('--show')) {
  console.log('当前上线信息：');
  console.log('  entityName   :', current.entityName || '(未填写)');
  console.log('  icpNumber    :', current.icpNumber || '(未填写)');
  console.log('  supportEmail :', current.supportEmail || '(未填写)');
  process.exit(0);
}

const entity = get('entity');
const icp = get('icp');
const email = get('email');
const errors = [];
if (entity && entity.length < 2) errors.push('主体名称至少 2 个字符');
if (icp && !ICP.test(icp)) errors.push('备案号需包含“ICP备+数字+号”，例如 京ICP备2024xxxxxx号-1X');
if (email && !EMAIL.test(email)) errors.push('邮箱格式不正确');
if (errors.length) {
  errors.forEach(message => console.error('错误：' + message));
  process.exit(1);
}
if (!entity && !icp && !email) {
  console.error('未提供任何要修改的值。可用参数：--entity / --icp / --email（可任选其一）');
  process.exit(1);
}

let source = current.source;
if (entity) source = applyField(source, 'entityName', entity);
if (icp) source = applyField(source, 'icpNumber', icp);
if (email) source = applyField(source, 'supportEmail', email);
writeFileSync(envPath, source);

const after = readEnvFields();
console.log('已写入 miniprogram/config/env.js：');
console.log('  entityName   :', after.entityName || '(未填写)');
console.log('  icpNumber    :', after.icpNumber || '(未填写)');
console.log('  supportEmail :', after.supportEmail || '(未填写)');
console.log('下一步：node scripts/release-preflight.mjs && npm test');
