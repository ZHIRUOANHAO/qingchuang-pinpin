const { caseCatalog } = require('./case-catalog')
const { caseLibraryMeta } = require('./case-library-meta')
const { difficultyValue, shortTitle, planetForIndex } = require('./case-shared')

function summary(item, index) {
  return {
    id: item.id,
    title: item.name,
    shortTitle: shortTitle(item.name),
    industry: item.industry,
    tags: item.tags || [],
    difficulty: difficultyValue(item.difficulty),
    difficultyLabel: item.difficulty,
    costLabel: item.cost,
    access: 'free',
    accessLabel: '免费全文',
    featured: index < 3,
    value: item.valueProposition,
    offer: item.offer || '',
    payer: item.payer || '',
    purchaseReason: item.purchaseReason || '',
    evidenceCheckedOn: item.evidenceCheckedOn || '',
    sourceTier: item.sourceTier,
    sourceStatusLabel: item.sourceTier === 'official_page' ? '官方公开页面记录' : '官方页面索引线索',
    compliance: item.complianceHint || '',
    sourceUrls: item.sourceUrls || [],
    planet: planetForIndex(index)
  }
}

const caseSummaries = caseCatalog.map(summary)

function findCaseSummary(id) {
  return caseSummaries.find(item => item.id === id) || null
}

module.exports = { caseSummaries, findCaseSummary, caseLibraryMeta }
