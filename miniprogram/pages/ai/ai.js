const { caseSummaries } = require('../../data/case-summaries')
const storage = require('../../utils/storage')
const { calculate } = require('../../utils/scoring')
const { createWorkflow } = require('../../utils/validation')

function toRecord(item) {
  return {
    id: item.id,
    title: item.title,
    summary: item.value,
    value: item.value,
    nodes: item.nodes,
    metrics: calculate(item.nodes),
    warnings: [item.compliance, '公开经营资料不等于成交或盈利证明。'].filter(Boolean),
    compliance: item.compliance,
    createdAt: Date.now()
  }
}

Page({
  data: {
    caseTitles: caseSummaries.map(item => item.title),
    featured: caseSummaries.slice(0, 6),
    selectedIndex: 0,
    selectedSummary: caseSummaries[0],
    analyzing: false,
    result: null,
    selectedNode: null,
    reducedMotion: false
  },

  onLoad(options = {}) {
    const selectedIndex = Math.max(0, caseSummaries.findIndex(item => item.id === options.id))
    this.setData({
      selectedIndex,
      selectedSummary: caseSummaries[selectedIndex],
      reducedMotion: getApp().globalData.reducedMotion
    })
  },

  onUnload() { clearTimeout(this.demoTimer) },

  chooseCase(event) {
    const selectedIndex = Number(event.detail.value) || 0
    this.setData({ selectedIndex, selectedSummary: caseSummaries[selectedIndex], result: null, selectedNode: null })
  },

  chooseFeatured(event) {
    const selectedIndex = caseSummaries.findIndex(item => item.id === event.currentTarget.dataset.id)
    if (selectedIndex < 0) return
    this.setData({ selectedIndex, selectedSummary: caseSummaries[selectedIndex], result: null, selectedNode: null }, () => this.runDemo())
  },

  runDemo() {
    clearTimeout(this.demoTimer)
    this.setData({ analyzing: true, result: null, selectedNode: null })
    this.demoTimer = setTimeout(() => {
      const { findCase } = require('../../data/cases')
      const item = findCase(this.data.selectedSummary.id)
      if (!item) {
        this.setData({ analyzing: false })
        wx.showToast({ title: '案例内容暂不可用', icon: 'none' })
        return
      }
      this.setData({
        analyzing: false,
        result: { ...item, displayNodes: item.businessNodes.length ? item.businessNodes : item.nodes }
      })
    }, this.data.reducedMotion ? 120 : 520)
  },

  reset() { this.setData({ result: null, selectedNode: null }) },

  selectNode(event) {
    const node = event.detail.node || (this.data.result && this.data.result.displayNodes.find(item => item.id === event.detail.id))
    if (node) this.setData({ selectedNode: node })
  },

  closeNode() { this.setData({ selectedNode: null }) },

  copySource(event) {
    const url = this.data.result.sourceUrls[Number(event.currentTarget.dataset.index)]
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) wx.setClipboardData({ data: url })
  },

  saveResult() {
    if (!this.data.result) return
    storage.appendUnique('analysisRecords', toRecord(this.data.result))
    wx.showToast({ title: '已保存到本机', icon: 'success' })
  },

  openCase() {
    if (this.data.result) wx.navigateTo({ url: `/pages/case-detail/case-detail?id=${this.data.result.id}` })
  },

  continueCanvas() {
    if (!this.data.result) return
    const record = toRecord(this.data.result)
    const workflow = createWorkflow({ ...record, sourceType: 'demo', sourceId: record.id })
    storage.write('activeWorkflow', workflow)
    storage.write('canvasNodes', workflow.nodes)
    wx.switchTab({ url: '/pages/canvas/canvas' })
  }
})
