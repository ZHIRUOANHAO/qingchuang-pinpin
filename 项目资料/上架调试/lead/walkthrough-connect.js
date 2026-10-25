'use strict'
/**
 * 轻创拼拼 —— 修复后页面级自动化走查（Lead 复核用）
 * 前置：已运行 cli.bat auto --project ... --auto-port 9421
 * 用法：node walkthrough-connect.js
 */
const automator = require('D:/UserFolders/Desktop/qingchuang-pinpin/项目资料/上架调试/devtools/node_modules/miniprogram-automator')
const fs = require('fs')
const path = require('path')

const ROOT = 'D:/UserFolders/Desktop/qingchuang-pinpin'
const OUT = __dirname
const SHOTS = path.join(OUT, 'shots')
const REPORT = path.join(OUT, 'automation-report-lead.json')
const WS = 'ws://127.0.0.1:9421'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'miniprogram/app.json'), 'utf8'))
const ALL_PAGES = appJson.pages
const TAB_PAGES = appJson.tabBar.list.map(i => i.pagePath)

function safe(value, depth = 0) {
  if (depth > 3) return String(value)
  if (value === null || ['number', 'string', 'boolean'].includes(typeof value)) return value
  if (Array.isArray(value)) return value.slice(0, 10).map(v => safe(v, depth + 1))
  if (typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value).slice(0, 20)) { try { out[k] = safe(value[k], depth + 1) } catch (e) { out[k] = '[x]' } }
    return out
  }
  return String(value)
}

async function connect() {
  for (let i = 0; i < 30; i++) {
    try { return await automator.connect({ wsEndpoint: WS }) }
    catch (e) { await sleep(2000) }
  }
  throw new Error('cannot connect ' + WS)
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const report = { startedAt: new Date().toISOString(), ws: WS, pages: [], shots: [], exceptions: [], consoleErrors: [], history: null, summary: {} }
  const mp = await connect()
  console.log('connected')
  mp.on('exception', e => report.exceptions.push(safe(e)))
  mp.on('console', res => { if (res && (res.type === 'error' || res.level === 'error')) report.consoleErrors.push(safe(res)) })

  try { report.systemInfo = safe(await mp.systemInfo()) } catch (e) { report.systemInfo = { error: String(e) } }
  try { report.globalData = safe(await mp.evaluate(() => { const g = getApp(); return { privacyAccepted: g.globalData.privacyAccepted, reducedMotion: g.globalData.reducedMotion, env: g.globalData.env && g.globalData.env.runtimeMode } })) } catch (e) { report.globalData = { error: String(e) } }

  for (const p of ALL_PAGES) {
    const url = '/' + p
    const isTab = TAB_PAGES.includes(p)
    const entry = { page: p, isTab, ok: false }
    try {
      const page = isTab ? await mp.switchTab(url) : await mp.navigateTo(url)
      await sleep(900)
      const cur = await mp.currentPage()
      entry.currentPath = cur && cur.path
      entry.ok = Boolean(cur && cur.path === p)
      entry.stack = (await mp.pageStack()).length
      try { entry.dataKeys = cur && cur.data ? Object.keys(cur.data).slice(0, 25) : [] } catch (e) {}
      try {
        const shot = path.join(SHOTS, p.replace(/^pages\//, '').replace(/\//g, '_') + '.png')
        await mp.screenshot({ path: shot })
        report.shots.push(shot)
        entry.shot = shot
      } catch (e) { entry.shotError = String(e).slice(0, 160) }
    } catch (e) {
      entry.error = String(e && e.message || e).slice(0, 300)
    }
    report.pages.push(entry)
    if (!isTab) { try { await mp.navigateBack() ; await sleep(400) } catch (e) {} }
  }

  // 最近浏览链路：直接打开 history，再回案例页点入口
  try {
    await mp.switchTab('/pages/cases/cases')
    await sleep(800)
    const cases = await mp.currentPage()
    const hasButton = await cases.$('.history-link')
    report.history = { casesPage: cases.path, entryButton: Boolean(hasButton) }
    const hist = await mp.navigateTo('/pages/history/history')
    await sleep(800)
    const hp = await mp.currentPage()
    const listLen = await hp.data('list')
    report.history.historyPage = hp.path
    report.history.listLength = Array.isArray(listLen) ? listLen.length : null
    try { await mp.screenshot({ path: path.join(SHOTS, 'history.png') }); report.shots.push(path.join(SHOTS, 'history.png')) } catch (e) {}
    await mp.navigateBack()
  } catch (e) { report.history = { error: String(e && e.message || e).slice(0, 300) } }

  report.summary = {
    total: report.pages.length,
    ok: report.pages.filter(p => p.ok).length,
    failed: report.pages.filter(p => !p.ok).map(p => ({ page: p.page, error: p.error || ('currentPath=' + p.currentPath) })),
    exceptions: report.exceptions.length,
    consoleErrors: report.consoleErrors.length
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.summary, null, 2))
  try { await mp.disconnect() } catch (e) {}
  process.exit(report.summary.failed.length ? 1 : 0)
}

main().catch(e => { console.error('FATAL', e && e.message || e); process.exit(2) })
