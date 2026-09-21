const { caseCatalog } = require('./case-catalog')
const { caseLibraryMeta } = require('./case-library-meta')

const palette = [0xd9bb72, 0x62c7d9, 0x9b87e8, 0x65c799, 0xd98f72, 0xc7a8dc]

function difficultyValue(label = '') {
  if (label.startsWith('入门')) return 2
  if (label.startsWith('中高')) return 3
  return 5
}

function summary(item, index) {
  return {
    id: item.id,
    title: item.name,
    shortTitle: item.name.split('：')[0].slice(0, 12),
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
    compliance: item.complianceHint || '',
    sourceUrls: item.sourceUrls || [],
    planet: {
      color: palette[index % palette.length],
      orbit: 2.8 + (index % 6) * .35,
      size: index < 3 ? .26 : .18
    }
  }
}

const caseSummaries = caseCatalog.map(summary)

function findCaseSummary(id) {
  return caseSummaries.find(item => item.id === id) || null
}

module.exports = { caseSummaries, findCaseSummary, caseLibraryMeta }
