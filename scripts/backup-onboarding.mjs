// Back up the reviewed source and tutorial project under the existing 2.0 release.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const mode = process.argv[2] || 'prepare';
assert.ok(['prepare', 'upload'].includes(mode));
const out = 'output/onboarding-github-backup-2026-11-02';
fs.mkdirSync(out, { recursive: true });
const names = ['qingchuang-pinpin-2.0-source.zip', 'qingchuang-pinpin-2.0-video-project.zip', 'qingchuang-pinpin-2.0-backup.json', 'qingchuang-pinpin-2.0-SHA256SUMS.txt'];
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const commit = git('rev-parse', 'HEAD');
const assetInfo = name => { const file = path.join(out, name); return { name, bytes: fs.statSync(file).size, sha256: hash(fs.readFileSync(file)) }; };
const save = (name, data) => fs.writeFileSync(path.join(out, name), `${JSON.stringify(data, null, 2)}\n`);
if (mode === 'prepare') {
  git('archive', '--format=zip', '--prefix=qingchuang-pinpin-2.0/', '--output=' + path.join(out, names[0]), commit);
  const python = `import pathlib,zipfile,json,sys,hashlib
root=pathlib.Path.cwd(); video=root/'videos/qingchuang-pinpin-onboarding'
allowed={'AGENTS.md','BRIEF.md','SPEC.md','STORYLINES.md','REVIEW.md','hyperframes.json','hyperframes.lock.json','index.html','meta.json','package.json','delivery.json'}
selected=[p for p in video.rglob('*') if p.is_file() and (p.relative_to(video).as_posix() in allowed or p.relative_to(video).parts[0] in {'assets','compositions','scripts','renders'}) and not any(x in p.parts for x in ['node_modules','.git','.hyperframes'])]
rows=[]
with zipfile.ZipFile(root/sys.argv[1],'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(selected):
  name=p.relative_to(video).as_posix(); data=p.read_bytes(); z.writestr('qingchuang-pinpin-onboarding/'+name,data); rows.append({'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
with zipfile.ZipFile(root/sys.argv[1]) as z:
 assert z.testzip() is None
 for r in rows: assert hashlib.sha256(z.read('qingchuang-pinpin-onboarding/'+r['file'])).hexdigest()==r['sha256']
with zipfile.ZipFile(root/sys.argv[2]) as z:
 assert z.testzip() is None
 assert 'qingchuang-pinpin-2.0/miniprogram/onboarding/media/quickstart.mp4' in z.namelist()
 assert not any(x.endswith('project.private.config.json') or (pathlib.PurePosixPath(x).name.startswith('.env') and pathlib.PurePosixPath(x).name!='.env.example') for x in z.namelist())
print(json.dumps(rows))`;
  const videoFiles = JSON.parse(execFileSync('python', ['-c', python, path.join(out, names[1]), path.join(out, names[0])], { encoding: 'utf8' }));
  const assets = names.slice(0, 2).map(assetInfo);
  save(names[2], { version: '0.1', last_updated: '2026-11-02', repository: 'ZHIRUOANHAO/qingchuang-pinpin', commit, tag: 'v2.0', status: 'preview', frozenTagCommit: git('rev-parse', 'v2.0^{}'), assets, videoFiles, privacy: 'No machine-private configuration, credentials, backend captures or development caches.' });
  fs.writeFileSync(path.join(out, names[3]), names.slice(0, 3).map(name => `${assetInfo(name).sha256}  ${name}`).join('\n') + '\n');
  console.log(JSON.stringify({ prepared: true, commit, files: names.map(assetInfo), videoFiles: videoFiles.length }));
} else {
  const manifest = JSON.parse(fs.readFileSync(path.join(out, names[2]), 'utf8'));
  assert.equal(manifest.commit, commit, 'Rebuild archives after changing commits');
  const local = names.map(assetInfo);
  for (const asset of manifest.assets) assert.deepEqual(assetInfo(asset.name), asset);
  const checksumRows = fs.readFileSync(path.join(out, names[3]), 'utf8').trim().split('\n');
  for (const line of checksumRows) { const [sha, name] = line.split('  '); assert.equal(assetInfo(name).sha256, sha); }
  const raw = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\nusername=ZHIRUOANHAO\n\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } });
  const credential = Object.fromEntries(raw.trim().split(/\r?\n/).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
  const headers = { Authorization: `Bearer ${credential.password}`, Accept: 'application/vnd.github+json', 'User-Agent': 'qingchuang-pinpin-onboarding-backup', 'X-GitHub-Api-Version': '2022-11-28' };
  async function request(url, method = 'GET', body, binary = false) {
    const result = await fetch(url.startsWith('https:') ? url : `https://api.github.com/${url}`, { method, headers: { ...headers, ...(body ? { 'Content-Type': binary ? 'application/zip' : 'application/json' } : {}) }, body: body ? (binary ? body : JSON.stringify(body)) : undefined, signal: AbortSignal.timeout(90000) });
    assert.ok(result.ok, `${method} failed: HTTP ${result.status}`); return result.json();
  }
  assert.equal((await request('user')).login, 'ZHIRUOANHAO');
  const base = 'repos/ZHIRUOANHAO/qingchuang-pinpin';
  const repo = await request(base); assert.ok(repo.private && repo.permissions.push);
  assert.equal((await request(`${base}/branches/master`)).commit.sha, commit);
  const before = await request(`${base}/releases/tags/v2.0`);
  assert.equal(before.id, 423851254); assert.equal(before.prerelease, true); save('release-before.json', before);
  const originalAssets = before.assets.filter(a => !names.includes(a.name));
  assert.equal(originalAssets.length, 26, 'Unexpected historical assets; inspect before modifying');
  for (const file of local) {
    const existing = before.assets.find(a => a.name === file.name);
    if (existing) { assert.equal(existing.size, file.bytes); assert.equal(existing.digest, `sha256:${file.sha256}`); }
    else {
      const upload = `https://uploads.github.com/${base}/releases/${before.id}/assets?name=${encodeURIComponent(file.name)}`;
      const result = await request(upload, 'POST', fs.readFileSync(path.join(out, file.name)), true);
      assert.equal(result.size, file.bytes); assert.equal(result.digest, `sha256:${file.sha256}`);
    }
    console.log(`Verified uploaded backup: ${file.name}`);
  }
  const intro = `## 2.0 当前备份（2026-11-02）\n\n本次已补齐新手引导：首次进入可跳过，支持“我的 → 新手引导”重看，32 秒字幕视频随包提供。源码提交：\`${commit}\`。\n\n- **当前源码：qingchuang-pinpin-2.0-source.zip**（包含已嵌入的视频和封面）。\n- 可编辑视频工程及母版：qingchuang-pinpin-2.0-video-project.zip。\n- 源提交及逐文件清单：qingchuang-pinpin-2.0-backup.json；附件校验：qingchuang-pinpin-2.0-SHA256SUMS.txt。\n\n下方自动生成的 Source code (zip/tar.gz) 仍对应原 v2.0 冻结快照。恢复本次完整代码请使用上面的当前源码附件。1.0 为已上线版，2.0 仍为体验版；本次 GitHub 备份不更新微信线上代码。微信 CLI 预览编译通过，手机实际播放仍待复验。\n\n---\n\n`;
  const oldBody = before.body.split('\n---\n\n').at(-1);
  await request(`${base}/releases/${before.id}`, 'PATCH', { body: intro + oldBody, prerelease: true, make_latest: 'false' });
  const [after, tags, releases, latest] = await Promise.all([request(`${base}/releases/tags/v2.0`), request(`${base}/tags?per_page=100`), request(`${base}/releases?per_page=100`), request(`${base}/releases/latest`)]);
  for (const a of originalAssets) { const now = after.assets.find(x => x.id === a.id); assert.ok(now); for (const key of ['name', 'size', 'digest', 'state']) assert.equal(now[key], a[key]); }
  for (const file of local) { const now = after.assets.find(a => a.name === file.name); assert.equal(now?.digest, `sha256:${file.sha256}`); }
  assert.deepEqual(tags.map(t => t.name).sort(), ['v1.0', 'v2.0']); assert.deepEqual(releases.map(r => r.tag_name).sort(), ['v1.0', 'v2.0']); assert.equal(latest.tag_name, 'v1.0');
  const receipt = { version: '0.1', last_updated: '2026-11-02', commit, release: after.html_url, newAssets: after.assets.filter(a => names.includes(a.name)).map(a => ({ name: a.name, bytes: a.size, sha256: a.digest, url: a.browser_download_url })), historicalAssetsPreserved: 26, latestStable: latest.tag_name };
  save('upload-receipt.json', receipt); console.log(JSON.stringify(receipt));
}
