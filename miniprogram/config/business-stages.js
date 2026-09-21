// User-facing commercial loop. The seven editorial questions remain available
// on each case; this layer gives the DNA and asset cards a consistent business
// phase vocabulary without pretending to be the operator's internal process.
const businessStages = [
  { id: 'positioning', number: 1, name: '卖点定位', chain: 'public', chainLabel: '公域增长链', themeStage: 'coldStart', color: '#d9bb72', sourceQuestions: [1] },
  { id: 'acquisition', number: 2, name: '引流获客', chain: 'public', chainLabel: '公域增长链', themeStage: 'coldStart', color: '#62c7d9', sourceQuestions: [4] },
  { id: 'nurture', number: 3, name: '种草教育', chain: 'public', chainLabel: '公域增长链', themeStage: 'validation', color: '#9b87e8', sourceQuestions: [3] },
  { id: 'conversion', number: 4, name: '转化成交', chain: 'private', chainLabel: '私域经营链', themeStage: 'validation', color: '#aab4c7', sourceQuestions: [2, 5] },
  { id: 'payment', number: 5, name: '收款', chain: 'private', chainLabel: '私域经营链', themeStage: 'monetization', color: '#d9bb72', sourceQuestions: [7] },
  { id: 'delivery', number: 6, name: '产品交付', chain: 'private', chainLabel: '私域经营链', themeStage: 'monetization', color: '#62c7d9', sourceQuestions: [6] },
  { id: 'retention', number: 7, name: '复购裂变', chain: 'private', chainLabel: '私域经营链', themeStage: 'operations', color: '#65c799', sourceQuestions: [] },
]

const text = value => String(value || '').trim()
const unique = values => [...new Set(values.map(text).filter(Boolean))]

function assetCard(stage, source, questions) {
  const q = number => questions.find(item => Number(item.number) === number) || {}
  const q1 = q(1); const q2 = q(2); const q3 = q(3); const q4 = q(4); const q5 = q(5); const q6 = q(6); const q7 = q(7)
  const common = {
    stageId: stage.id,
    stageName: stage.name,
    chainLabel: stage.chainLabel,
    goal: '',
    how: '',
    tracks: unique([source.industry]),
    assets: { traffic: [], content: [], user: [], delivery: [] },
    cost: text(source.cost) || '整案实验成本待核算',
    difficulty: text(source.difficulty) || '待评估',
    risk: text(source.complianceHint) || '风险待核实',
    reuse: unique([q1.reusableUnit, q2.reusableUnit, q3.reusableUnit, q4.reusableUnit, q5.reusableUnit, q6.reusableUnit, q7.reusableUnit]).join('；'),
  }
  if (stage.id === 'positioning') {
    common.goal = '把商品、价值和承诺边界说清楚。'
    common.how = text(q1.action) || `明确提供的${source.offer || source.delivery}，不把案例写成收益保证。`
    common.assets.content = unique([source.offer, source.valueProposition, q1.reusableUnit])
    common.assets.user = unique([source.payer])
    common.risk = '标题猎奇、承诺过度或把第三方素材当成自己的商品。'
  } else if (stage.id === 'acquisition') {
    common.goal = '让目标用户在可解释的公开入口看见并进入承接位置。'
    common.how = text(q4.action) || text(source.acquisition?.visibleChannels) || '先记录可观察入口，再核对真实成交来源。'
    common.assets.traffic = unique([source.acquisition?.visibleChannels, q4.reusableUnit])
    common.assets.content = unique([source.offer, source.valueProposition])
    common.assets.user = unique([source.payer])
    common.risk = text(source.acquisition?.limitation) || '可见入口不等于主要获客渠道或成交证明。'
  } else if (stage.id === 'nurture') {
    common.goal = '用样例和解释降低理解成本，形成可核实的购买理由。'
    common.how = text(q3.action) || text(source.purchaseReason) || '展示前后差异，并记录用户是否真正理解。'
    common.assets.content = unique([source.purchaseReason, source.valueProposition, q3.reusableUnit])
    common.assets.user = unique([source.payer])
    common.risk = '购买理由是编辑分析，不等于客户访谈或成交证据。'
  } else if (stage.id === 'conversion') {
    common.goal = '把兴趣转成明确的对象、范围、报价和交易约定。'
    common.how = unique([q2.action, q5.action]).join(' ')
    common.assets.user = unique([source.payer, source.targetAudience])
    common.assets.content = unique([source.chargingModel, q5.reusableUnit])
    common.risk = '不把报价、点击或口头意向写成已成交；合同和限制条件需要另核。'
  } else if (stage.id === 'payment') {
    common.goal = '区分订单、实际到账、退款和扣除成本后的剩余。'
    common.how = text(q7.action) || text(source.moneyFlow) || '按实际约定记录收款时点与成本。'
    common.assets.user = unique([source.payer])
    common.assets.content = unique([source.chargingModel, source.moneyFlow])
    common.risk = '实际到账、退款、总成本和净利润尚未独立核实。'
  } else if (stage.id === 'delivery') {
    common.goal = '按约交付一个买家能验收的具体结果。'
    common.how = text(q6.action) || text(source.delivery) || '先写交付清单，再记录返工和维护责任。'
    common.assets.delivery = unique([source.delivery, q6.reusableUnit])
    common.assets.content = unique([source.entryRequirements, source.offer])
    common.risk = '交付范围、授权和售后责任不清会导致返工或侵权。'
  } else {
    common.goal = '把可验证的交付结果变成再次购买或自然分享的触发点。'
    common.how = unique([source.validation?.measure, source.validation?.firstAction, source.principle]).join(' ') || '先观察交付结果，再询问是否有下一次需求。'
    common.assets.user = unique([source.payer, '已完成一次交付的用户'])
    common.assets.content = unique([source.validation?.measure, source.principle, '复购与转介绍记录'])
    common.assets.delivery = unique([source.delivery])
    common.risk = '复购、裂变和留存尚未核实；不得把一次满意表达写成持续增长。'
  }
  common.tracksText = common.tracks.join('、') || '以当前案例为准'
  common.riskNote = `${common.risk} ${text(source.cost) ? `当前口径：${source.cost}。` : ''}`
  return common
}

function composeBusinessStages(source = {}) {
  const questions = Array.isArray(source.stages) ? source.stages : []
  return businessStages.map(stage => ({ ...stage, sourceQuestionNames: stage.sourceQuestions.map(number => text(questions[number - 1]?.name)).filter(Boolean), assetCard: assetCard(stage, source, questions) }))
}

function buildBusinessNodes(source = {}) {
  return composeBusinessStages(source).map(stage => ({
    id: `${source.id || 'case'}_business_${stage.id}`,
    name: stage.name,
    type: stage.id,
    canvasModuleId: stage.id,
    chain: stage.chain,
    stage: stage.themeStage,
    stageLabel: stage.name,
    businessStage: stage.id,
    businessStageNumber: stage.number,
    businessStageLabel: stage.name,
    definition: stage.assetCard.goal,
    method: stage.assetCard.how,
    industries: stage.assetCard.tracks.join('、'),
    cost: 0,
    costStatus: 'not_individually_estimated',
    sourceCaseId: source.id,
    sourceTitle: source.name || source.title,
    costLabel: source.cost,
    difficulty: stage.assetCard.difficulty,
    risk: 0,
    riskStatus: 'not_individually_estimated',
    riskNote: stage.assetCard.riskNote,
    reuse: stage.assetCard.reuse,
    assetCard: stage.assetCard,
  }))
}

module.exports = { businessStages, composeBusinessStages, buildBusinessNodes }
