const storage = require('../../utils/storage')
const { calculate } = require('../../utils/scoring')
const { createWorkflow, updateWorkflow, planProgress, summaryText } = require('../../utils/validation')

Page({
  data: {
    workflow: null,
    plan: null,
    hasCaseNodes: false,
    progress: { completed: 0, total: 7, percent: 0 },
    decisionLabels: { pending: '待复盘', continue: '继续', adjust: '调整', pause: '暂停' }
  },
  onLoad() { this.loadWorkflow() },
  loadWorkflow() {
    const current = storage.read('activeWorkflow', null)
    if (!current) {
      wx.showModal({ title: '还没有验证方案', content: '请先从案例、案例演示或画布生成一份方案。', showCancel: false, success: () => wx.navigateBack() })
      return
    }
    const nodes = current.nodes || []
    const workflow = createWorkflow({ ...current, metrics: calculate(nodes), workflowId: current.id })
    this.setData({ workflow, plan: workflow.validation, progress: planProgress(workflow.validation), hasCaseNodes: nodes.some(node => node.costStatus === 'not_individually_estimated') })
  },
  toggleDay(event) {
    const index = Number(event.currentTarget.dataset.index)
    const days = this.data.plan.days.map((day, dayIndex) => dayIndex === index ? { ...day, done: !day.done } : day)
    this.updatePlan({ ...this.data.plan, days })
  },
  recordResult(event) {
    const index = Number(event.currentTarget.dataset.index)
    const days = this.data.plan.days.map((day, dayIndex) => dayIndex === index ? { ...day, result: event.detail.value } : day)
    this.updatePlan({ ...this.data.plan, days })
  },
  setDecision(event) { this.updatePlan({ ...this.data.plan, decision: event.currentTarget.dataset.value }) },
  updatePlan(plan) {
    const workflow = updateWorkflow(this.data.workflow, { validation: plan })
    this.setData({ workflow, plan: workflow.validation, progress: planProgress(workflow.validation) })
  },
  saveProgress() {
    const workflow = updateWorkflow(this.data.workflow, { validation: this.data.plan })
    storage.write('activeWorkflow', workflow)
    storage.appendUnique('validationRuns', { ...workflow, id: workflow.id, updatedAt: Date.now() })
    if (workflow.schemeId) {
      storage.appendUnique('schemes', { ...workflow, id: workflow.schemeId, workflowId: workflow.id, updatedAt: Date.now() })
    }
    this.setData({ workflow, plan: workflow.validation, progress: planProgress(workflow.validation) })
    wx.showToast({ title: '进度已保存', icon: 'success' })
  },
  copySummary() {
    wx.setClipboardData({ data: summaryText(this.data.workflow), success: () => wx.showToast({ title: '摘要已复制', icon: 'success' }) })
  },
  backCanvas() {
    storage.write('activeWorkflow', updateWorkflow(this.data.workflow, { validation: this.data.plan }))
    storage.write('canvasNodes', this.data.workflow.nodes)
    wx.switchTab({ url: '/pages/canvas/canvas' })
  },
  onShareAppMessage() {
    return { title: `${this.data.workflow.title}｜7天验证方案`, path: '/pages/home/home' }
  }
})
