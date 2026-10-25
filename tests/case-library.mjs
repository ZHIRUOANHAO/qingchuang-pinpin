import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cases as webCases, caseLibraryMeta as webMeta } from '../preview/data.js'
import { caseCatalog as webCatalog, freeCaseDetails as webFreeDetails } from '../preview/case-library.js'

const require = createRequire(import.meta.url)
const { cases, findCase, caseLibraryMeta } = require('../miniprogram/data/cases')
const { caseSummaries } = require('../miniprogram/data/case-summaries')
const { caseCatalog } = require('../miniprogram/data/case-catalog')
const { freeCaseDetails } = require('../miniprogram/data/case-free-details')

assert.equal(cases.length, 100)
assert.equal(new Set(cases.map(item => item.id)).size, 100)
assert.equal(cases.filter(item => item.access === 'free').length, 100)
assert.equal(cases.filter(item => item.access === 'paid').length, 0)
assert.ok(cases.filter(item => item.access === 'free').every(item => !item.locked && item.nodes.length === 7))
assert.ok(cases.every(item => !item.locked && item.nodes.length === 7))
const businessStageNames = ['卖点定位', '引流获客', '种草教育', '转化成交', '收款', '产品交付', '复购裂变']
assert.ok(cases.every(item => item.businessNodes.length === 7 && item.businessNodes.map(node => node.name).join('|') === businessStageNames.join('|')))
assert.ok(cases.every(item => item.businessNodes.every(node => node.assetCard?.goal && node.assetCard?.how && node.assetCard?.risk && node.assetCard?.tracksText)))
assert.equal(caseSummaries.length, cases.length)
for (const [index, item] of cases.entries()) {
  const summary = caseSummaries[index]
  assert.equal(summary.id, item.id)
  assert.equal(summary.shortTitle, item.shortTitle, `${item.id}: short title remains shared`)
  assert.equal(summary.difficulty, item.difficulty, `${item.id}: difficulty remains shared`)
  assert.deepEqual(summary.planet, item.planet, `${item.id}: planet remains shared`)
  assert.ok(item.businessNodes.every((node, stageIndex) => node.assetCard === item.businessStages[stageIndex].assetCard), `${item.id}: stage cards are constructed once`)
}
assert.ok(caseCatalog.every(item => !('stages' in item) && !('validation' in item) && !('moneyFlow' in item)))
assert.ok(freeCaseDetails.every(item => item.access === 'free'))
assert.equal(caseLibraryMeta.paidFullTextBundled, false)
assert.equal(findCase('real_001').title, caseCatalog[0].name)
assert.equal(findCase('real_021').locked, false)
assert.equal(findCase('real_100').locked, false)
assert.equal(findCase('missing-id'), null)
assert.equal(webCases.length, 100)
assert.equal(webCases.filter(item => !item.locked && item.nodes.length === 7).length, 100)
assert.ok(webCases.every(item => item.businessNodes.length === 7 && item.businessNodes.map(node => node.name).join('|') === businessStageNames.join('|')))
assert.ok(webCases.every(item => item.businessNodes.every(node => node.assetCard?.goal && node.assetCard?.how && node.assetCard?.risk)))
assert.equal(webCases.filter(item => item.locked).length, 0)
assert.equal(webCatalog.length, 100)
assert.equal(webFreeDetails.length, 100)
assert.equal(freeCaseDetails.length, 100)
assert.equal(caseLibraryMeta.free, 100)
assert.equal(caseLibraryMeta.paid, 0)
assert.equal(caseLibraryMeta.pricingStatus, 'free_first_ads_later')
assert.equal(caseLibraryMeta.adsEnabled, false)
assert.equal(webMeta.paidFullTextBundled, false)
assert.ok(webCatalog.every(item => !('stages' in item) && !('validation' in item) && !('moneyFlow' in item)))
assert.ok(caseCatalog.every(item => item.offer && item.payer && item.purchaseReason && item.evidenceCheckedOn), 'every summary identifies the offer, payer and reasoning provenance')
assert.ok(caseCatalog.every(item => item.evidenceCheckedOn && item.sourceUrls?.length), 'every case has a dated public source record')
assert.equal(caseLibraryMeta.officialPageCount, 86)
assert.equal(caseLibraryMeta.indexOnlyCount, 14)
assert.equal(caseCatalog.filter(item => item.sourceTier === 'official_page').length, 86)
assert.equal(caseCatalog.filter(item => item.sourceTier === 'official_index').length, 14)
assert.ok(cases.every(item => item.scoreLabel === '不设经营评分' && !item.hasScore), 'source checking must not be confused with an unverified business score')
assert.ok(webCases.every(item => item.scoreLabel === '不设经营评分' && !item.hasScore), 'preview and mini program agree on score semantics')
assert.ok(freeCaseDetails.every(item => item.stages[0].name === '卖什么与卖点' && item.stages[5].name === '交付什么、如何验收' && item.stages[6].name === '怎么收钱、剩下多少'), 'every full case starts with selling and ends with delivery and cash collection')
assert.ok(freeCaseDetails.every(item => item.stages.every(stage => stage.type && stage.epistemicStatus === 'editorial_analysis_not_internal_company_process')))
assert.ok(cases.filter(item => !item.locked).every(item => item.delivery && item.chargingModel && item.moneyFlow && item.entryRequirements), 'readable cases expose the trade instead of dropping these fields in the adapter')
const publicDetailKeys = new Set(['id', 'name', 'industry', 'difficulty', 'cost', 'access', 'accessLabel', 'chainSummary', 'complianceHint', 'delivery', 'chargingModel', 'moneyFlow', 'principle', 'startupCost', 'acquisition', 'requirements', 'factualBasis', 'validation', 'stages'])
assert.ok(freeCaseDetails.every(item => Object.keys(item).every(key => publicDetailKeys.has(key))), 'free reading exports only whitelisted case fields, not arbitrary internal records')
for (const item of freeCaseDetails) {
  assert.deepEqual(Object.keys(item.factualBasis).sort(), ['checkedOn', 'observation', 'sources'])
  assert.ok(item.factualBasis.observation && item.factualBasis.sources.length, `${item.id}: observation and sources are visible`)
  const catalogItem = caseCatalog.find(entry => entry.id === item.id)
  assert.equal(item.factualBasis.checkedOn, catalogItem.evidenceCheckedOn)
  for (const source of item.factualBasis.sources) {
    assert.deepEqual(Object.keys(source).sort(), ['access', 'checkedOn', 'host', 'label', 'publisher', 'url'])
    assert.equal(new URL(source.url).protocol, 'https:')
    assert.ok(catalogItem.sourceUrls.includes(source.url), `${item.id}: proof link matches the public catalog`)
    assert.equal(source.checkedOn, item.factualBasis.checkedOn)
  }
  assert.equal(catalogItem.sourceTier, item.factualBasis.sources.some(source => source.access === '官方公开页面') ? 'official_page' : 'official_index')
  assert.deepEqual(Object.keys(item.requirements), ['skills'])
  assert.deepEqual(Object.keys(item.startupCost), ['experimentCashCNY'])
  assert.ok(item.stages.every(stage => Object.keys(stage).every(key => ['number', 'name', 'type', 'action', 'transformation', 'reusableUnit', 'epistemicStatus'].includes(key))))
}
assert.equal(cases.find(item => item.id === 'real_006').payer, '希望触达该读者群体的广告主', 'ad-sponsored newsletter readers are not mistaken for paying advertisers')
assert.match(cases[0].nodes[0].method, /Notion 模板/)
assert.match(cases[0].nodes[6].method, /到账额|到账|净利润/)
assert.ok(!freeCaseDetails[0].validation.firstAction.includes('口播'), 'template practice no longer contains an unrelated speaking-content task')
assert.equal(cases[0].nodes[0].type, 'nurture', 'the offer is a value-validation node, not traffic')
for (const item of cases) {
  const web = webCases.find(entry => entry.id === item.id)
  for (const key of ['offer', 'payer', 'purchaseReason', 'delivery', 'chargingModel', 'moneyFlow', 'evidenceCheckedOn']) assert.equal(web[key], item[key], `${item.id}: ${key}`)
  assert.notDeepEqual(item.businessNodes.map(node => node.assetCard.how), cases[(cases.indexOf(item) + 1) % cases.length].businessNodes.map(node => node.assetCard.how), `${item.id}: stage cards are case-specific`)
}

function packageBytes(directory) {
  return readdirSync(directory, { withFileTypes: true }).reduce((sum, entry) => {
    if (entry.name === 'node_modules') return sum
    const path = join(directory, entry.name)
    return sum + (entry.isDirectory() ? packageBytes(path) : statSync(path).size)
  }, 0)
}
const bytes = packageBytes(fileURLToPath(new URL('../miniprogram/', import.meta.url)))
assert.ok(bytes < 2 * 1024 * 1024, 'static package estimate, excluding node_modules but including miniprogram_npm, stays within the 2 MiB project budget')
console.log(`Case library validation: 100 catalog / 100 free full text / 700 editorial stages / 700 business asset cards / 0 paid; public fields only. Static mini package estimate: ${bytes} bytes (not an official upload measurement).`)
