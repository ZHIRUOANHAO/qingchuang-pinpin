// Shared view model: lines describe membership, not causation or verified results.
const assetMap = (() => {
  const DEFAULT_COLOR = '#d9bb72'
  const groups = [
    ['traffic', '流量资产'], ['content', '内容资产'],
    ['user', '用户资产'], ['delivery', '交付资产']
  ]
  const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
  const color = value => /^#[0-9a-f]{6}$/i.test(text(value)) ? text(value) : DEFAULT_COLOR
  const strings = value => Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : []
  const branch = (id, title, summary, items, tint, number = '') => ({
    id, title, summary: text(summary), items: strings(items), color: color(tint), number
  })

  function buildCaseMap(title, nodes = []) {
    const list = Array.isArray(nodes) ? nodes.filter(node => node && typeof node === 'object') : []
    return {
      root: { id: 'case', title: text(title) || '当前案例', subtitle: '案例结构 · 连线表示资产归属', color: DEFAULT_COLOR },
      branches: list.map((node, index) => {
        const card = node.assetCard || {}
        const categories = groups.flatMap(([key, label]) => {
          const entries = strings(card.assets && card.assets[key])
          return entries.length ? [`${label} · ${entries.length} 项`] : []
        })
        return branch(text(node.id) || `stage-${index + 1}`, text(node.name) || `阶段 ${index + 1}`,
          card.goal || node.definition || node.method, categories, node.color, String(index + 1).padStart(2, '0'))
      })
    }
  }

  function buildNodeMap(node) {
    if (!node || typeof node !== 'object') return null
    const card = node.assetCard
    const tint = color(node.color)
    const branches = []
    const add = (id, title, summary, items = []) => {
      const item = branch(id, title, summary, items, tint)
      if (item.summary || item.items.length) branches.push(item)
    }
    if (card && typeof card === 'object') {
      add('goal', '阶段目标', card.goal)
      add('method', '具体怎么做', card.how)
      add('tracks', '适用赛道', card.tracksText || strings(card.tracks).join('、'))
      groups.forEach(([key, label]) => add(`assets-${key}`, label, '', card.assets && card.assets[key]))
      add('cost', '成本与难度', [text(card.cost), text(card.difficulty)].filter(Boolean).join(' · '))
      add('risk', '风险边界', card.riskNote || card.risk)
      add('reuse', '可复用单元', card.reuse)
    } else {
      add('definition', '环节定义', node.definition || node.hint)
      add('method', '执行方法', node.method)
      add('tracks', '适用赛道', Array.isArray(node.industries) ? strings(node.industries).join('、') : node.industries)
      if (node.costStatus === 'not_individually_estimated') {
        add('cost', '案例来源与成本口径', [text(node.sourceTitle), text(node.costLabel), '此节点未单独核算成本或量化风险，不代表收益承诺。'].filter(Boolean).join(' · '))
      } else {
        if (text(node.cost)) add('cost', '模板成本示例', `¥${text(node.cost)}`)
        if (text(node.difficulty)) add('difficulty', '参考难度', `${text(node.difficulty)}/5`)
        if (node.riskStatus !== 'not_individually_estimated' && text(node.risk)) add('risk-example', '模板风险示例', node.risk)
      }
      add('risk', '风险点', node.riskNote)
      add('reuse', '可复用技巧', node.reuse)
    }
    return {
      root: { id: text(node.id) || 'stage', title: text(node.name) || '阶段资产卡', subtitle: '阶段 → 字段 → 具体资产 · 编辑分析', color: tint },
      branches
    }
  }
  return { buildCaseMap, buildNodeMap }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = assetMap
else globalThis.QingchuangAssetMap = assetMap
