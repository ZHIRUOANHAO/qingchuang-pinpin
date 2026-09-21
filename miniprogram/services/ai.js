const { env } = require('../config/env')
const { findCase } = require('../data/cases')
const { createWorkflow } = require('../utils/validation')

function mockAnalysis(input, sourceType = 'text') {
  const sample = findCase('real_001')
  return new Promise(resolve => {
    const result = {
      id: `analysis_${Date.now()}`,
      title: input && input.length > 6 ? input.slice(0, 18) : '原创资料产品验证',
      sourceType,
      summary: '系统识别到一条以公开信息结构化、原创交付和小额验证为核心的轻资产链路。',
      nodes: sample.nodes,
      metrics: { completeness: 84, risk: 28, startupCost: 100, difficulty: 2 },
      warnings: ['不要复制或销售他人原文', '不要承诺流量、成交或收入结果'],
      provider: 'mock',
      model: env.deepseekModel
    }
    result.validation = createWorkflow({ ...result, sourceType: 'ai' }).validation
    setTimeout(() => resolve(result), 1100)
  })
}

async function uploadMaterial(localPath, sourceType) {
  if (!localPath) return ''
  const extension = sourceType === 'pdf' ? 'pdf' : (localPath.split('.').pop() || 'png').toLowerCase()
  const cloudPath = `ai-input/${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`
  const result = await wx.cloud.uploadFile({ cloudPath, filePath: localPath })
  return result.fileID
}

async function analyze({ input = '', sourceType = 'text', fileId = '' }) {
  if (env.mockMode || !wx.cloud) return mockAnalysis(input, sourceType)

  const apiSourceType = sourceType === 'web' ? 'text' : sourceType
  const cloudFileId = ['image', 'pdf'].includes(apiSourceType)
    ? await uploadMaterial(fileId, apiSourceType)
    : ''

  const { result } = await wx.cloud.callFunction({
    name: 'aiRouter',
    data: { input, sourceType: apiSourceType, fileId: cloudFileId }
  })
  if (!result || result.ok === false) throw new Error(result && result.message ? result.message : 'AI拆解失败')
  const data = result.data
  if (!data.validation) data.validation = createWorkflow({ ...data, sourceType: 'ai' }).validation
  return data
}

module.exports = { analyze, mockAnalysis, uploadMaterial }
