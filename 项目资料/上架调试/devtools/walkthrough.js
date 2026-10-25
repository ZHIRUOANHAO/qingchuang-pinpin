'use strict'
/**
 * 轻创拼拼 —— 微信开发者工具自动化走查脚本
 * 依赖：miniprogram-automator@0.13.0（安装于本目录 node_modules）
 * 用法：node walkthrough.js
 * 产出：shots/*.png + automation-report.json
 * 注意：只读取项目与操作模拟器，不修改 miniprogram/ 源码。
 */
const automator = require('miniprogram-automator')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = 'D:/UserFolders/Desktop/qingchuang-pinpin'
const CLI = 'D:/应用/微信web开发者工具/cli.bat'
const OUT = __dirname
const SHOTS = path.join(OUT, 'shots')
const REPORT = path.join(OUT, 'automation-report.json')
const PORT = 9421

const sleep = ms => new Promise(r => setTimeout(r, ms))
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'miniprogram/app.json'), 'utf8'))
const ALL_PAGES = appJson.pages
const TAB_PAGES = appJson.tabBar.list.map(i => i.pagePath)
const legalPages = ['pages/privacy/privacy', 'pages/agreement/agreement', 'pages/minors/minors', 'pages/help/help', 'pages/about/about']

function safeJson(value, depth = 0) {
  if (depth > 4) return String(value)
  if (value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map(v => safeJson(v, depth + 1))
  if (typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value).slice(0, 30)) {
      try { out[k] = safeJson(value[k], depth + 1) } catch (e) { out[k] = '[unserializable]' }
    }
    return out
  }
  return String(value)
}

function slug(p) {
  return p.replace(/^pages\//, '').replace(/\//g, '_')
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const report = {
    startedAt: new Date().toISOString(),
    env: { root: ROOT, cli: CLI, appJsonPages: ALL_PAGES, tabPages: TAB_PAGES },
    launch: null,
    systemInfo: null,
    globalData: null,
    pages: [],
    screenshots: [],
    historyJump: null,
    unregisteredAttempts: [],
    consoleLogs: [],
    exceptions: [],
    pageNotFound: [],
    summary: {}
  }

  console.log('[1] launching automator ...')
  const t0 = Date.now()
  let mp = null
  // 说明：miniprogram-automator@0.13.0 的 Launcher 直接用 child_process.spawn 调用 cli.bat，
  // 在 Node 22 / Windows 下无法执行 .bat（ENOENT/EINVAL），会报
  // "Failed to launch wechat web devTools, please make sure cliPath is correctly specified"。
  // 方案 A：外部已用 cli auto 起好自动化服务（ws://127.0.0.1:9421），直接 connect；
  // 方案 B（回退）：shell:true 自行 spawn cli auto，再 connect 到 --auto-port 指定的 ws 端口。
  let cliChild = null
  let cliOutput = ''
  try {
    mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT })
    report.launch = { ok: true, method: 'connect-existing', elapsedMs: Date.now() - t0 }
    console.log('[1a] connected to existing ws://127.0.0.1:' + PORT)
  } catch (preErr) {
    report.preConnect = { ok: false, error: String(preErr && preErr.message || preErr) }
    console.log('[1a] no existing automation server, fallback to spawn cli auto')
  }
  const connectTry = async () => {
    const args = ['auto', '--project', ROOT, '--auto-port', String(PORT), '--trust-project']
    cliChild = spawn(CLI, args, { shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    cliChild.stdout.on('data', d => { cliOutput += String(d) })
    cliChild.stderr.on('data', d => { cliOutput += String(d) })
    cliChild.on('exit', code => { cliOutput += '\n[cli auto exit code] ' + code })
    const deadline = Date.now() + 150000
    let lastErr = null
    while (Date.now() < deadline) {
      try {
        return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT })
      } catch (e) {
        lastErr = e
        await sleep(2000)
      }
    }
    throw new Error('连接 ws://127.0.0.1:' + PORT + ' 超时: ' + String(lastErr && lastErr.message || lastErr) + '\n[cli output]\n' + cliOutput.trim())
  }
  if (!mp) {
    try {
      mp = await connectTry()
      report.launch = { ok: true, elapsedMs: Date.now() - t0, cliOutput: cliOutput.trim(), method: 'spawn cli auto (shell:true) + automator.connect' }
    } catch (e) {
      report.launch = { ok: false, error: String(e && e.stack || e), cliOutput: cliOutput.trim() }
      fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
      console.error('[FATAL] launch failed:', e)
      try { if (cliChild) cliChild.kill() } catch (e2) {}
      process.exit(2)
    }
  }

  mp.on('console', res => {
    report.consoleLogs.push({ at: new Date().toISOString(), ...safeJson(res) })
  })
  mp.on('exception', err => {
    report.exceptions.push({ at: new Date().toISOString(), ...safeJson(err) })
  })
  mp.on('pageNotFound', p => {
    report.pageNotFound.push({ at: new Date().toISOString(), ...safeJson(p) })
  })

  try { report.systemInfo = safeJson(await mp.systemInfo()) } catch (e) { report.systemInfo = { error: String(e) } }
  try { report.globalData = safeJson(await mp.evaluate(() => { const g = getApp(); return { env: g.globalData.env, privacyAccepted: g.globalData.privacyAccepted, reducedMotion: g.globalData.reducedMotion } })) } catch (e) { report.globalData = { error: String(e) } }

  // ---- 逐个打开 app.json 注册页 ----
  for (let i = 0; i < ALL_PAGES.length; i++) {
    const p = ALL_PAGES[i]
    const url = '/' + p
    const isTab = TAB_PAGES.includes(p)
    const entry = { page: p, kind: isTab ? 'switchTab' : 'navigateTo', ok: false }
    const started = Date.now()
    try {
      const page = isTab ? await mp.switchTab(url) : await mp.navigateTo(url)
      await sleep(1500)
      const cur = await mp.currentPage()
      entry.currentPath = cur && cur.path
      entry.title = cur && cur.data && (cur.data.navTitle || cur.data.title || cur.data.brand) || undefined
      entry.pageQuery = cur && cur.query
      entry.stackDepth = (await mp.pageStack()).length
      let dataSummary = null
      try {
        const d = cur && cur.data ? cur.data : {}
        dataSummary = {
          dataKeys: Object.keys(d).slice(0, 30),
          total: d.total, loading: d.loading, error: d.error,
          listLen: Array.isArray(d.list) ? d.list.length : undefined,
          itemId: d.item && d.item.id
        }
      } catch (e) { dataSummary = { error: String(e) } }
      entry.dataSummary = dataSummary
      const shot = path.join(SHOTS, String(i + 1).padStart(2, '0') + '-' + slug(p) + '.png')
      await mp.screenshot({ path: shot })
      entry.screenshot = path.relative(OUT, shot).replace(/\\/g, '/')
      report.screenshots.push(entry.screenshot)
      entry.ok = true
    } catch (e) {
      entry.error = String(e && e.message || e)
    }
    entry.elapsedMs = Date.now() - started
    if (!isTab) { try { await mp.navigateBack() ; await sleep(500) } catch (e) { try { await mp.switchTab('/pages/home/home') } catch (e2) {} } }
    report.pages.push(entry)
    console.log('[page]', p, entry.ok ? 'OK' : 'FAIL', entry.currentPath || entry.error, entry.elapsedMs + 'ms')
  }

  // ---- 五个 tabBar 页额外确认（含二次切换）----
  try {
    for (const t of TAB_PAGES) {
      await mp.switchTab('/' + t)
      await sleep(400)
      const cur = await mp.currentPage()
      const found = report.pages.find(x => x.page === t)
      if (found) found.switchTabRecheck = cur && cur.path
    }
  } catch (e) { report.tabRecheckError = String(e) }

  // ---- cases 页“最近浏览”按钮跳转验证 ----
  try {
    await mp.switchTab('/pages/cases/cases')
    await sleep(1500)
    const page = await mp.currentPage()
    const btn = await page.$('.history-link')
    report.historyJump = { selector: '.history-link', found: !!btn }
    if (btn) {
      report.historyJump.text = await btn.text()
      const before = await mp.currentPage()
      report.historyJump.pathBeforeTap = before && before.path
      await btn.tap()
      await sleep(1600)
      const after = await mp.currentPage()
      report.historyJump.pathAfterTap = after && after.path
      report.historyJump.navigated = !!(after && after.path === 'pages/history/history')
      report.historyJump.stackDepthAfterTap = (await mp.pageStack()).length
    }
  } catch (e) {
    report.historyJump = { ...(report.historyJump || {}), error: String(e && e.message || e) }
  }

  // ---- 验证未注册页面的行为（history 及其他源码目录中存在但 app.json 未注册的页）----
  const unregistered = ['pages/history/history', 'pages/account/account', 'pages/login/login', 'pages/membership/membership', 'pages/orders/orders', 'pages/practice/practice', 'pages/practice-records/practice-records']
  try { await mp.switchTab('/pages/home/home') } catch (e) {}
  for (const u of unregistered) {
    const attempt = { page: u, target: '/' + u }
    try {
      await mp.navigateTo('/' + u)
      await sleep(800)
      const cur = await mp.currentPage()
      attempt.result = 'navigated'
      attempt.currentPath = cur && cur.path
    } catch (e) {
      attempt.result = 'failed'
      attempt.error = String(e && e.message || e)
    }
    report.unregisteredAttempts.push(attempt)
    try { await mp.navigateBack().catch(() => mp.switchTab('/pages/home/home')) } catch (e) {}
    console.log('[unregistered]', u, attempt.result, attempt.error || '')
  }

  // ---- 列表 -> 详情 真实点击链路 ----
  try {
    await mp.switchTab('/pages/cases/cases')
    await sleep(1500)
    const page = await mp.currentPage()
    const items = await page.$$('.case-item')
    report.caseListTap = { caseItemCount: items.length }
    if (items.length) {
      await items[0].tap()
      await sleep(1500)
      const cur = await mp.currentPage()
      report.caseListTap.pathAfterTap = cur && cur.path
      report.caseListTap.itemId = cur && cur.data && cur.data.item && cur.data.item.id
      report.caseListTap.ok = !!(cur && cur.path === 'pages/case-detail/case-detail')
    }
  } catch (e) { report.caseListTap = { error: String(e && e.message || e) } }

  // ---- 统计 ----
  report.summary = {
    pagesTotal: ALL_PAGES.length,
    pagesOk: report.pages.filter(p => p.ok).length,
    pagesFailed: report.pages.filter(p => !p.ok).map(p => p.page),
    screenshots: report.screenshots.length,
    consoleCount: report.consoleLogs.length,
    consoleErrorCount: report.consoleLogs.filter(l => l.type === 'error').length,
    exceptionCount: report.exceptions.length,
    pageNotFoundCount: report.pageNotFound.length,
    historyNavigated: !!(report.historyJump && report.historyJump.navigated),
    caseListTapOk: !!(report.caseListTap && report.caseListTap.ok),
    unregisteredFailures: report.unregisteredAttempts.filter(a => a.result === 'failed').map(a => a.page)
  }
  report.finishedAt = new Date().toISOString()
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log('[summary]', JSON.stringify(report.summary))

  try { await mp.disconnect() } catch (e) {}
  process.exit(0)
}

main().catch(async e => {
  console.error('[FATAL]', e && e.stack || e)
  process.exit(1)
})
