import { readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
const root = resolve('miniprogram')
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'))
const pages = new Set(app.pages.map(p => '/' + p))
const tabPages = new Set((app.tabBar?.list || []).map(i => '/' + i.pagePath))
const files = []
function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', 'miniprogram_npm', 'miniprogram_npm', '.git'].includes(e.name)) continue
    const p = join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (['.js', '.wxml', '.json'].includes(extname(p))) files.push(p)
  }
}
walk(root)
const targetRe = /(?:url\s*:\s*['"`]|url\s*=\s*['"])(\/pages\/[A-Za-z0-9_\/\-]+)/g
const found = new Map()
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  let m
  while ((m = targetRe.exec(src))) {
    const url = m[1].split('?')[0]
    if (!found.has(url)) found.set(url, new Set())
    found.get(url).add(f.replaceAll('\\', '/'))
  }
}
const missing = []
const ok = []
for (const [url, refs] of found) {
  const isTab = tabPages.has(url)
  if (!pages.has(url)) missing.push({ url, refs: [...refs] })
  else ok.push({ url, isTab, refs: [...refs] })
}
console.log('registered pages:', pages.size)
console.log('OK nav targets:', ok.length)
for (const o of ok) console.log('  OK  ' + o.url + (o.isTab ? ' [tab]' : '') + ' <- ' + o.refs.join(', '))
console.log('MISSING nav targets:', missing.length)
for (const m of missing) console.log('  MISSING  ' + m.url + ' <- ' + m.refs.join(', '))
