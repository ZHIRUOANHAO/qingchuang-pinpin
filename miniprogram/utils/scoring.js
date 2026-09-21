const CORE_TYPES = ['exposure', 'traffic', 'nurture', 'conversion', 'transaction', 'delivery', 'retention', 'risk']

function calculate(nodes = []) {
  const uniqueTypes = new Set(nodes.map(node => node.type))
  const completeness = Math.round((uniqueTypes.size / CORE_TYPES.length) * 100)
  const startupCost = nodes.reduce((sum, node) => sum + Number(node.cost || 0), 0)
  const weightedRisk = nodes.length
    ? Math.round(nodes.reduce((sum, node) => sum + Number(node.risk || 0), 0) / nodes.length)
    : 0
  const difficulty = nodes.length
    ? Math.round(nodes.reduce((sum, node) => sum + Number(node.difficulty || 1), 0) / nodes.length)
    : 1
  const missing = CORE_TYPES.filter(type => !uniqueTypes.has(type))

  return {
    completeness,
    startupCost,
    risk: weightedRisk,
    difficulty,
    missing,
    canExport: completeness >= 75 && weightedRisk < 70,
    advice: missing.length
      ? `优先补齐 ${missing.slice(0, 2).join(' / ')} 环节，再做付费验证。`
      : '闭环已成形，建议先用小样本和小价格验证真实需求。'
  }
}

module.exports = { calculate, CORE_TYPES }

