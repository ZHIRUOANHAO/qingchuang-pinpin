const modules = [
  { id: 'exposure', name: '卖点定位', chain: 'public', color: '#d9bb72', cost: 10, difficulty: 1, risk: 15, hint: '把商品、价值和承诺边界说清楚' },
  { id: 'traffic', name: '引流获客', chain: 'public', color: '#62c7d9', cost: 20, difficulty: 2, risk: 25, hint: '把注意力带到可承接位置' },
  { id: 'nurture', name: '种草教育', chain: 'public', color: '#9b87e8', cost: 20, difficulty: 2, risk: 18, hint: '建立理解与可核实的购买理由' },
  { id: 'conversion', name: '转化成交', chain: 'private', color: '#aab4c7', cost: 10, difficulty: 2, risk: 20, hint: '把兴趣变成明确交易约定' },
  { id: 'transaction', name: '收款', chain: 'private', color: '#d9bb72', cost: 10, difficulty: 3, risk: 30, hint: '区分订单、到账、退款和成本' },
  { id: 'delivery', name: '产品交付', chain: 'private', color: '#62c7d9', cost: 30, difficulty: 3, risk: 22, hint: '按约交付并减少返工' },
  { id: 'retention', name: '复购裂变', chain: 'private', color: '#65c799', cost: 20, difficulty: 3, risk: 18, hint: '由可验证结果带来再次购买或分享' },
  { id: 'referral', name: '裂变', chain: 'private', color: '#9b87e8', cost: 10, difficulty: 3, risk: 26, hint: '可验证成果带来自然分享' },
  { id: 'profit', name: '利润', chain: 'private', color: '#d9bb72', cost: 0, difficulty: 2, risk: 12, hint: '收入减去完整成本' },
  { id: 'risk', name: '风控', chain: 'private', color: '#ef7d83', cost: 0, difficulty: 2, risk: 8, hint: '版权、规则、隐私与承诺' }
]

module.exports = { modules }
