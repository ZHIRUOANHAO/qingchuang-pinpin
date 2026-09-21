import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const launcher = fileURLToPath(new URL('../scripts/start-preview.ps1', import.meta.url));
const blocker = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('unrelated-test-server');
});

await new Promise(resolve => blocker.listen(0, '127.0.0.1', resolve));
const basePort = blocker.address().port;
let previewPid;
let checks = 0;
try {
  const launch = () => run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher, '-Port', String(basePort), '-NoBrowser'], { cwd: root, timeout: 20000, windowsHide: true });
  const first = await launch();
  const url = first.stdout.match(/http:\/\/127\.0\.0\.1:\d+\/preview\//)?.[0];
  assert.ok(url, 'launcher reports a ready URL');
  checks++;
  assert.notEqual(Number(new URL(url).port), basePort, 'occupied port is not reused');
  checks++;
  const healthUrl = new URL('/__preview_health', url);
  const health = await (await fetch(healthUrl)).json();
  assert.equal(health.service, 'qingchuang-pinpin-preview', 'server survives launcher exit');
  previewPid = health.pid;
  checks++;
  assert.equal(await (await fetch(`http://127.0.0.1:${basePort}`)).text(), 'unrelated-test-server', 'unrelated server remains available');
  checks++;
  const second = await launch();
  assert.ok(second.stdout.includes(url), 'repeated launch keeps the same URL');
  assert.equal((await (await fetch(healthUrl)).json()).pid, previewPid, 'repeated launch reuses the same process');
  checks++;
  assert.equal((await fetch(url)).status, 200, 'preview HTML is available');
  checks++;
  console.log(`Preview launcher: ${checks} passed, 0 failed.`);
} finally {
  // Only terminate the temporary server started by this test, never the user's preview.
  if (previewPid) process.kill(previewPid);
  await new Promise(resolve => blocker.close(resolve));
}
