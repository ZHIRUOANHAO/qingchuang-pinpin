// One-time, recoverable consolidation. Credentials remain in memory only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const mode = process.argv[2] || 'inspect';
assert.ok(['inspect', 'apply', 'verify'].includes(mode), 'Expected inspect, apply or verify');
const plan = JSON.parse(fs.readFileSync('backups/version-map.json', 'utf8'));
const out = 'output/version-consolidation-2026-10-27';
fs.mkdirSync(out, { recursive: true });
const expectedLogin = 'ZHIRUOANHAO';
assert.equal(plan.repository, `${expectedLogin}/qingchuang-pinpin`);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const save = (name, data) => fs.writeFileSync(path.join(out, name), `${JSON.stringify(data, null, 2)}\n`);

const bodies = {
  'v1.0': `轻创拼拼 1.0 已上线版对应源码归档。\n\n下载下方 **Source code (zip)** 获取源码。代表提交：\`${plan.versions[0].sourceCommit}\`。\n\n- 收纳 09-21、09-23、10-08 的早期备份。\n- 与 10-21 优化前备份共有的 168 个文件一致（忽略 Windows 换行差异）。\n- 未保存微信上传包校验值或完整回执，尚不能确认与线上 1.0 包完全一致。\n\n[2.0 体验版](https://github.com/${plan.repository}/releases/tag/v2.0) · [版本及恢复说明](https://github.com/${plan.repository}/blob/master/backups/README.md)\n\n两个版本的配套历史资料统一保存在 2.0 页，不再按调试日期另列版本。`,
  'v2.0': `轻创拼拼 2.0 体验版（预发布）。\n\n**获取当前代码：下载下方 Source code (zip)。** 用户于 2026-11-01 确认：1.0 已上线，2.0 是体验版；本页标为预发布。\n\n本版包含：\n- 首页行星轨道、视觉效果及手机端按钮布局优化。\n- 阶段资产卡导图和连线展示。\n- 案例阅读与交互完善，修复案例演示模型未随页面滚动的问题。\n\n相关原生界面 20 项、体验逻辑 15 项回归通过；手机实测和微信审核结果分别核对。[已知问题报告](https://github.com/${plan.repository}/blob/master/docs/其他问题审核测试-2026-10-26.md)仍保留。\n\n**其余 26 个附件是配套历史资料，不是 26 个版本。** 历史 ZIP 为 17 卷，旧主仓库 bundle 为 4 卷，另有文档 bundle 和恢复清单。旧 bundle 截止于 180da46，不含后续优化；请用上面的 Source code 获取 2.0。\n\n需要历史资料时，将全部附件下载至同一新目录，执行：\n\n\`\`\`powershell\npython .\\restore-github-backup.py .\\archive-parts.json\n\`\`\`\n\n需要 Python 3.11 或以上；恢复工具核验分卷和合并文件 SHA256，不覆盖已有文件。原始备份、五个旧标签的映射及全部提交历史保留。\n\n[1.0 已上线版](https://github.com/${plan.repository}/releases/tag/v1.0) · [版本及恢复说明](https://github.com/${plan.repository}/blob/master/backups/README.md)`
};

async function main() {
  const raw = execFileSync('git', ['credential', 'fill'], {
    input: `protocol=https\nhost=github.com\nusername=${expectedLogin}\n\n`, encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const credential = Object.fromEntries(raw.trim().split(/\r?\n/).map(line => {
    const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)];
  }));
  assert.ok(credential.password, 'Existing GitHub authorization unavailable');
  const headers = { Authorization: `Bearer ${credential.password}`, Accept: 'application/vnd.github+json',
    'User-Agent': 'qingchuang-pinpin-version-consolidation', 'X-GitHub-Api-Version': '2022-11-28' };
  async function request(route, method = 'GET', body, missing = false) {
    const response = await fetch(`https://api.github.com/${route}`, {
      method, headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(45000)
    });
    if (missing && response.status === 404) return null;
    assert.ok(response.ok, `GitHub ${method} ${route}: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  const base = `repos/${plan.repository}`;
  const user = await request('user');
  assert.equal(user.login, expectedLogin, 'Unexpected GitHub account');
  const repo = await request(base);
  assert.ok(repo.private && repo.permissions.push, 'Expected writable private repository');
  const releases = await request(`${base}/releases?per_page=100`);
  const tags = await request(`${base}/tags?per_page=100`);
  if (mode === 'inspect') {
    save('inspect.json', { version: '0.1', last_updated: '2026-11-01', login: user.login, releases, tags });
    for (const [tag, body] of Object.entries(bodies)) fs.writeFileSync(path.join(out, `${tag}-release.md`), body);
    console.log(JSON.stringify({ login: user.login, releases: releases.map(r => ({ id: r.id, tag: r.tag_name, assets: r.assets.length })), tags: tags.map(t => t.name) }));
    return;
  }

  const before = JSON.parse(fs.readFileSync(path.join(out, 'before.json'), 'utf8'));
  const historical = before.releases.find(r => r.id === plan.historicalRelease.id);
  assert.ok(historical, 'Migration baseline missing');
  assert.equal(historical.assets.length, plan.historicalRelease.assetCount);
  assert.equal(historical.assets.reduce((n, a) => n + a.size, 0), plan.historicalRelease.assetBytes);
  const assets = release => release.assets.map(a => ({ id: a.id, name: a.name, size: a.size, digest: a.digest, state: a.state })).sort((a, b) => a.id - b.id);
  const expectedAssets = assets(historical);
  const v2Commit = git('rev-parse', 'v2.0^{}');
  assert.equal(git('rev-parse', 'v1.0^{}'), plan.versions[0].sourceCommit);
  assert.equal(git('diff', plan.versions[1].sourceCommit, v2Commit, '--', 'miniprogram', 'preview', 'package.json', 'project.config.json'), '', '2.0 source changed since reviewed snapshot');
  for (const [tag, sha] of [['v1.0', plan.versions[0].sourceCommit], ['v2.0', v2Commit]]) {
    const remote = await request(`${base}/commits/${tag}`);
    assert.equal(remote.sha, sha, `${tag} remote commit mismatch`);
  }
  for (const old of plan.legacyTags) {
    assert.equal(git('rev-parse', `refs/tags/${old.name}`), old.tagObject, 'Local recovery tag changed');
    git('merge-base', '--is-ancestor', old.commit, v2Commit);
  }
  const previousRelease = releases.find(r => r.id === historical.id);
  assert.ok(previousRelease, 'Original asset-bearing release missing');
  assert.ok([plan.historicalRelease.previousTag, 'v2.0'].includes(previousRelease.tag_name), 'Original release was changed unexpectedly');
  assert.deepEqual(assets(previousRelease), expectedAssets, 'Historical assets changed before migration');
  assert.ok(releases.every(r => r.id === historical.id || r.tag_name === 'v1.0'), 'Unreviewed release exists');
  assert.ok(tags.every(t => ['v1.0', 'v2.0', ...plan.legacyTags.map(x => x.name)].includes(t.name)), 'Unreviewed tag exists');
  const publishedMaster = await request(`${base}/branches/master`);
  assert.equal(publishedMaster.commit.sha, v2Commit, 'Publish reviewed source and docs before migrating releases');
  assert.ok(!previousRelease.immutable, 'Original release is immutable');
  const existingV1 = releases.find(r => r.tag_name === 'v1.0');
  if (existingV1) assert.equal(existingV1.body, bodies['v1.0'], 'Unexpected existing 1.0 description');

  if (mode === 'apply') {
    if (!releases.some(r => r.tag_name === 'v1.0')) {
      await request(`${base}/releases`, 'POST', { tag_name: 'v1.0', name: '轻创拼拼 1.0 · 已上线版归档', body: bodies['v1.0'], draft: false, prerelease: false, make_latest: 'true' });
      console.log('Created 1.0 release');
    }
    const updated = await request(`${base}/releases/${historical.id}`, 'PATCH', {
      tag_name: 'v2.0', name: '轻创拼拼 2.0 · 体验版', body: bodies['v2.0'], draft: false, prerelease: true, make_latest: 'false'
    });
    assert.deepEqual(assets(updated), expectedAssets, 'Asset verification failed; old tags retained');
    save('release-migrated.json', { id: updated.id, tag: updated.tag_name, assets: assets(updated) });
    console.log('2.0 release updated; all 26 original assets preserved');
    for (const old of plan.legacyTags) {
      const route = `${base}/git/refs/tags/${encodeURIComponent(old.name)}`;
      const remoteRef = await request(`${base}/git/ref/tags/${encodeURIComponent(old.name)}`, 'GET', undefined, true);
      if (!remoteRef) continue;
      assert.equal(remoteRef.object.sha, old.tagObject, 'Remote old tag changed; refusing deletion');
      await request(route, 'DELETE');
      console.log(`Archived old remote label: ${old.name}`);
    }
  }
  const [finalReleases, finalTags, latest, master] = await Promise.all([
    request(`${base}/releases?per_page=100`), request(`${base}/tags?per_page=100`),
    request(`${base}/releases/latest`), request(`${base}/branches/master`)
  ]);
  assert.deepEqual(finalReleases.map(r => r.tag_name).sort(), ['v1.0', 'v2.0']);
  assert.deepEqual(finalTags.map(t => t.name).sort(), ['v1.0', 'v2.0']);
  assert.equal(latest.tag_name, 'v1.0');
  assert.equal(master.commit.sha, v2Commit, 'Master differs from newly archived 2.0');
  assert.deepEqual(assets(finalReleases.find(r => r.tag_name === 'v2.0')), expectedAssets);
  for (const release of finalReleases) {
    assert.equal(release.body, bodies[release.tag_name], 'Release description mismatch');
    assert.equal(release.draft, false);
    assert.equal(release.prerelease, release.tag_name === 'v2.0');
  }
  const result = { version: '0.1', last_updated: '2026-11-01', repository: plan.repository, login: user.login,
    latest: latest.tag_name, master: master.commit.sha, tags: finalTags.map(t => ({ name: t.name, commit: t.commit.sha })),
    releases: finalReleases.map(r => ({ id: r.id, tag: r.tag_name, prerelease: r.prerelease, url: r.html_url, assets: r.assets.map(a => ({ ...assets({assets:[a]})[0], url: a.browser_download_url })) })),
    originalAssetsUnchanged: true, historyPreserved: true, localLegacyTagsPreserved: true };
  save('after.json', result);
  console.log(JSON.stringify({ verified: true, latest: result.latest, tags: result.tags, urls: result.releases.map(r => r.url), unchangedAssets: expectedAssets.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
