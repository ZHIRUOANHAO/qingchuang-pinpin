const { businessStages, stageIdForNode } = require('../config/business-stages')
const { difficultyValue } = require('../data/case-shared')

const CORE_TYPES = businessStages.map(stage => stage.id)
const stageNames = Object.fromEntries(businessStages.map(stage => [stage.id, stage.name]))

function numericDifficulty(value) {
  const number = Number(value)
  if (Number.isFinite(number) && number > 0) return number
  const label = String(value || '').trim()
  return label ? difficultyValue(label) : 1
}

function calculate(nodes = []) {
  const coveredStages = new Set(nodes.map(stageIdForNode).filter(Boolean))
  const completeness = Math.round((coveredStages.size / CORE_TYPES.length) * 100)
  const startupCost = nodes.reduce((sum, node) => sum + Number(node.cost || 0), 0)
  const weightedRisk = nodes.length
    ? Math.round(nodes.reduce((sum, node) => sum + Number(node.risk || 0), 0) / nodes.length)
    : 0
  const difficulty = nodes.length
    ? Math.round(nodes.reduce((sum, node) => sum + numericDifficulty(node.difficulty), 0) / nodes.length)
    : 1
  const missing = CORE_TYPES.filter(type => !coveredStages.has(type))
  const hasUnverifiedCaseNode = nodes.some(node => node.costStatus === 'not_individually_estimated')

  return {
    completeness,
    startupCost,
    risk: weightedRisk,
    difficulty,
    missing,
    canExport: completeness >= 75 && weightedRisk < 70 && !hasUnverifiedCaseNode,
    advice: missing.length
      ? `优先补齐 ${missing.slice(0, 2).map(id => stageNames[id]).join(' / ')} 环节，再做小样本验证。`
      : hasUnverifiedCaseNode
        ? '七个结构环节已覆盖；案例证据、成本和风险仍需逐项核实。'
        : '七个结构环节已覆盖，建议先用小样本验证真实需求。'
  }
}

module.exports = { calculate, CORE_TYPES }

