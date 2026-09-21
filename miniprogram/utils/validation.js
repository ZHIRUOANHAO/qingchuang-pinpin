const TYPE_LABELS = {
  exposure: '曝光',
  traffic: '引流',
  nurture: '种草',
  conversion: '转化',
  transaction: '成交',
  delivery: '交付',
  retention: '复购',
  referral: '裂变',
  profit: '利润',
  risk: '风控'
}

const DAY_TEMPLATES = [
  ['表面现象', '用不超过 50 字写清这条商业主线。'],
  ['用户痛点', '找 5 位目标用户，确认问题是否真实存在。'],
  ['最小交付', '完成 1 页样张或 1 个最小可用模板。'],
  ['理解测试', '配 3 张原理卡，请用户复述其中的逻辑。'],
  ['付费测试', '写清谁付钱、为什么付、测试价格是多少。'],
  ['风险边界', '删除侵权、夸大、违规和无法交付的部分。'],
  ['成交验证', '向 10 位目标用户展示样品并进行真实报价。']
]

function nodeTypes(nodes = []) {
  return nodes.map(node => node.type || node.id)
}

function inferAnswers(workflow = {}) {
  const types = nodeTypes(workflow.nodes)
  const hasDelivery = types.includes('delivery')
  const hasTransaction = types.includes('transaction')
  return {
    audience: workflow.audience || '有明确问题、愿意用小额成本换取时间与清晰方案的人',
    painPoint: workflow.painPoint || '想法很多，但缺少可执行的商业链路和真实反馈',
    minimumDeliverable: workflow.minimumDeliverable || (hasDelivery ? '1 页可直接试用的样张或最小模板' : '先补齐可被用户实际使用的最小交付物'),
    testPrice: workflow.testPrice || (hasTransaction ? '9.9 元体验样张 / 49 元轻定制' : '先完成访谈，再设置小额真实报价'),
    firstAction: workflow.firstAction || '把主线讲给 3 位目标用户，请他们复述并询问付费意愿',
    notDoing: workflow.notDoing || '不先开发完整产品，不承诺流量、成交或收入结果'
  }
}

function buildValidationPlan(workflow = {}, previous = null) {
  const answers = inferAnswers(workflow)
  const warningText = (workflow.warnings || []).join('；')
  const days = DAY_TEMPLATES.map(([checkpoint, action], index) => {
    const old = previous && previous.days ? previous.days[index] : null
    return {
      id: `day_${index + 1}`,
      day: index + 1,
      checkpoint,
      action,
      done: Boolean(old && old.done),
      result: old && old.result ? old.result : ''
    }
  })
  return {
    ...answers,
    riskBoundary: workflow.compliance || warningText || '遵守版权、平台、隐私与宣传规则，不复制他人内容，不作收益承诺。',
    days,
    feedbackQuestions: [
      '你能不能用自己的话复述这条商业逻辑？',
      '哪一个环节最容易理解，哪一个最模糊？',
      '你愿意为 9.9 元、19.9 元还是 49 元的版本付费？',
      '如果不愿付费，原因是看不懂、不需要、不信任、太贵，还是样品不够好？'
    ],
    criteria: {
      continue: '至少 3 人能复述主线，至少 1 人愿意付费或明确预订。',
      adjust: '用户能看懂，但不知道如何使用，或只接受免费样品。',
      pause: '10 位目标用户无人能复述，或存在无法处理的合规风险。'
    },
    decision: previous && previous.decision ? previous.decision : 'pending',
    updatedAt: Date.now()
  }
}

function createWorkflow(source = {}) {
  const base = {
    id: source.workflowId || source.id || `workflow_${Date.now()}`,
    sourceType: source.sourceType || 'canvas',
    sourceId: source.sourceId || source.id || '',
    title: source.title || '我的商业DNA方案',
    summary: source.summary || source.value || '从最小商业节点出发，拼装并验证一条真实闭环。',
    nodes: source.nodes || [],
    metrics: source.metrics || {},
    warnings: source.warnings || [],
    compliance: source.compliance || '',
    audience: source.audience || '',
    painPoint: source.painPoint || '',
    minimumDeliverable: source.minimumDeliverable || '',
    testPrice: source.testPrice || '',
    firstAction: source.firstAction || '',
    notDoing: source.notDoing || '',
    schemeId: source.schemeId || '',
    createdAt: source.createdAt || Date.now(),
    updatedAt: Date.now()
  }
  return { ...base, validation: buildValidationPlan(base, source.validation) }
}

function updateWorkflow(workflow, changes = {}) {
  return createWorkflow({ ...workflow, ...changes, workflowId: workflow.id, createdAt: workflow.createdAt, validation: changes.validation || workflow.validation })
}

function missingLabels(missing = []) {
  return missing.map(type => TYPE_LABELS[type] || type)
}

function planProgress(plan = {}) {
  const days = plan.days || []
  const completed = days.filter(day => day.done).length
  return { completed, total: days.length, percent: days.length ? Math.round((completed / days.length) * 100) : 0 }
}

function summaryText(workflow = {}) {
  const plan = workflow.validation || buildValidationPlan(workflow)
  const metrics = workflow.metrics || {}
  return [
    `《${workflow.title || '商业验证方案'}》`,
    `目标用户：${plan.audience}`,
    `最小交付：${plan.minimumDeliverable}`,
    `测试价格：${plan.testPrice}`,
    `首个动作：${plan.firstAction}`,
    `风险边界：${plan.riskBoundary}`,
    `闭环完整度：${metrics.completeness || 0}%｜风险：${metrics.risk || 0}｜启动成本：¥${metrics.startupCost || 0}`
  ].join('\n')
}

module.exports = { TYPE_LABELS, buildValidationPlan, createWorkflow, updateWorkflow, missingLabels, planProgress, summaryText }
