const { caseCatalog } = require('./case-catalog')
const { freeCaseDetails } = require('./case-free-details')
const { caseLibraryMeta } = require('./case-library-meta')
const { difficultyValue, shortTitle, planetForIndex } = require('./case-shared')
const { composeBusinessStages, buildBusinessNodes } = require('../config/business-stages')

const nodeTypes = ['exposure', 'traffic', 'nurture', 'transaction', 'delivery', 'risk', 'profit']
const freeById = Object.fromEntries(freeCaseDetails.map(item => [item.id, item]))

function minimumCost(label = '') {
  const match = String(label).match(/(\d+)\s*-\s*\d+\s*元/)
  return match ? Number(match[1]) : 0
}

function stageToNode(stage, item) {
  const index = Math.max(0, Math.min(nodeTypes.length - 1, Number(stage.number || 1) - 1))
  return {
    id: `${item.id}_stage_${stage.number}`,
    name: stage.name,
    type: stage.type || nodeTypes[index],
    chain: index < 3 ? 'public' : 'private',
    definition: stage.transformation,
    method: stage.action,
    industries: item.industry,
    cost: 0,
    costStatus: 'not_individually_estimated',
    sourceCaseId: item.id,
    sourceTitle: item.name,
    costLabel: item.cost,
    difficulty: difficultyValue(item.difficulty),
    risk: 0,
    riskStatus: 'not_individually_estimated',
    reuse: stage.reusableUnit,
    epistemicStatus: stage.epistemicStatus
  }
}

function buildCase(catalogItem, index) {
  const detail = freeById[catalogItem.id]
  const nodes = detail ? detail.stages.map(stage => stageToNode(stage, detail)) : []
  const source = detail ? { ...catalogItem, ...detail, id: catalogItem.id, title: catalogItem.name } : null
  const businessStages = source ? composeBusinessStages(source) : []
  const businessNodes = source ? buildBusinessNodes(source, businessStages) : []
  const costLabel = detail?.cost || catalogItem.cost
  return {
    id: catalogItem.id,
    title: catalogItem.name,
    shortTitle: shortTitle(catalogItem.name),
    industry: catalogItem.industry,
    tags: catalogItem.tags,
    difficulty: difficultyValue(catalogItem.difficulty),
    difficultyLabel: catalogItem.difficulty,
    startupCost: detail?.startupCost?.experimentCashCNY?.[0] ?? minimumCost(costLabel),
    costLabel,
    score: 0,
    scoreLabel: '不设经营评分',
    hasScore: false,
    access: catalogItem.access,
    accessLabel: catalogItem.accessLabel,
    locked: !detail,
    featured: Boolean(detail && index < 3),
    value: catalogItem.valueProposition,
    offer: catalogItem.offer || '',
    payer: catalogItem.payer || '',
    purchaseReason: catalogItem.purchaseReason || '',
    evidenceCheckedOn: catalogItem.evidenceCheckedOn || '',
    sourceTier: catalogItem.sourceTier,
    sourceStatusLabel: catalogItem.sourceTier === 'official_page' ? '官方公开页面记录' : '官方页面索引线索',
    proofSources: detail?.factualBasis?.sources || [],
    delivery: detail?.delivery || '',
    chargingModel: detail?.chargingModel || '',
    moneyFlow: detail?.moneyFlow || '',
    acquisition: detail?.acquisition?.visibleChannels || '',
    originalEvidence: detail?.factualBasis?.observation || '',
    entryRequirements: detail?.requirements?.skills || '',
    chain: detail?.chainSummary ? detail.chainSummary.replaceAll(' -> ', ' → ') : '',
    compliance: detail?.complianceHint || catalogItem.complianceHint,
    sourceUrls: catalogItem.sourceUrls || [],
    evidenceLabel: 'E1 公开运营依据',
    validation: detail?.validation || null,
    principle: detail?.principle || '',
    nodes,
    businessStages,
    businessNodes,
    planet: planetForIndex(index)
  }
}

const cases = caseCatalog.map(buildCase)
const defaultNodes = cases.find(item => item.nodes.length)?.nodes || []

function findCase(id) {
  return cases.find(entry => entry.id === id) || null
}

module.exports = { cases, defaultNodes, findCase, caseLibraryMeta }
