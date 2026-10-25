const { findCase } = require('../../data/cases')
const storage = require('../../utils/storage')
const share = require('../../services/share')
const { calculate } = require('../../utils/scoring')
const { createWorkflow, updateWorkflow } = require('../../utils/validation')
const { describeNode } = require('../../utils/dna-renderer')
const caseHistory = require('../../utils/case-history')
const { buildCaseMap } = require('../../utils/asset-map')

Page({
  data: { item: findCase('real_001'), selectedNode: null, favorite: false, reducedMotion: false, chainSteps: [], nodeIndex: [], assetMap: null },
  onLoad(options = {}) {
    const item = findCase(options.id || 'real_001')
    if (!item) { this.setData({ item: null, selectedNode: null, chainSteps: [], nodeIndex: [], assetMap: null }); return }
    const favorite = storage.read('favorites', []).some(entry => entry.id === item.id)
    const displayNodes = item.businessNodes && item.businessNodes.length ? item.businessNodes : item.nodes
    const chainSteps = (item.businessStages || []).map(stage => ({ title: stage.name, number: String(stage.number).padStart(2, '0') }))
    const nodeIndex = displayNodes.map((node, index) => ({ ...describeNode(node), number: String(index + 1).padStart(2, '0') }))
    this.setData({ item: { ...item, displayNodes }, favorite, chainSteps, nodeIndex, assetMap: buildCaseMap(item.title, nodeIndex), reducedMotion: getApp().globalData.reducedMotion })
    try { caseHistory.rememberCase({ id: item.id, title: item.title, industry: item.industry }) } catch (error) {}
  },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) }) },
  selectNode(event) { const node = event.detail.node || this.data.item.displayNodes.find(entry => entry.id === event.detail.id); if (node) this.setData({ selectedNode: node }) },
  selectNodeFromIndex(event) { const id = event.detail && event.detail.id || event.currentTarget && event.currentTarget.dataset.id; const node = this.data.nodeIndex.find(entry => entry.id === id); if (node) this.setData({ selectedNode: node }) },
  closeNode() { this.setData({ selectedNode: null }) },
  copySource(event) {
    const url = this.data.item.proofSources[Number(event.currentTarget.dataset.index)]?.url
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return
    wx.setClipboardData({ data: url })
  },
  toggleFavorite() {
    const favorite = !this.data.favorite
    if (favorite) storage.appendUnique('favorites', this.data.item)
    else storage.removeById('favorites', this.data.item.id)
    this.setData({ favorite }); wx.showToast({ title: favorite ? '已收藏' : '已取消', icon: 'none' })
  },
  activateWorkflow() {
    const item = this.data.item
    const caseNodes = item && (item.businessNodes?.length ? item.businessNodes : item.nodes)
    if (!caseNodes?.length) { wx.showToast({ title: '案例正文暂不可用', icon: 'none' }); return null }
    const previousNodes = storage.read('canvasNodes', []).filter(node => !String(node.id || '').startsWith(`${item.id}_stage_`))
    const nodesById = new Map(previousNodes.concat(caseNodes).map(node => [node.id, node]))
    const nodes = [...nodesById.values()]
    const existing = storage.read('activeWorkflow', null)
    const workflow = previousNodes.length && existing
      ? updateWorkflow(existing, { nodes, metrics: calculate(nodes) })
      : createWorkflow({ ...item, sourceType: 'case', sourceId: item.id, summary: item.value, nodes, metrics: calculate(nodes) })
    storage.write('activeWorkflow', workflow)
    storage.write('canvasNodes', nodes)
    return workflow
  },
  sendToCanvas() { if (this.activateWorkflow()) wx.switchTab({ url: '/pages/canvas/canvas' }) },
  openReport() { if (this.activateWorkflow()) wx.navigateTo({ url: '/pages/validation/validation' }) },
  onShareAppMessage() { const item = this.data.item; return item ? share.pageMessage(`${item.title}｜免费案例`, `/pages/case-detail/case-detail?id=${item.id}`) : share.pageMessage('轻创拼拼｜免费案例', '/pages/home/home') }
})
