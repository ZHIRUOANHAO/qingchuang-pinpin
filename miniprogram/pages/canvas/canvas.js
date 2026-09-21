const { modules } = require('../../data/modules')
const { calculate } = require('../../utils/scoring')
const storage = require('../../utils/storage')
const { createWorkflow, updateWorkflow, missingLabels } = require('../../utils/validation')
Page({
  data: { modules: [], nodes: [], metrics: calculate([]), title: '我的商业DNA方案', sourceLabel: '画布新建', missingText: '', drawerOpen: false, selectedNode: null, reducedMotion: false },
  onLoad() { this.sync(storage.read('canvasNodes', [])) },
  onShow() { this.sync(storage.read('canvasNodes', this.data.nodes)) },
  sync(nodes) {
    const normalized = nodes.map(node => ({ ...modules.find(item => item.id === node.id), ...node, type: node.type || node.id }))
    const metrics = calculate(normalized)
    const existing = storage.read('activeWorkflow', null)
    const workflow = existing
      ? updateWorkflow(existing, { nodes: normalized, metrics })
      : createWorkflow({ nodes: normalized, metrics })
    storage.write('activeWorkflow', workflow)
    this.setData({ nodes: normalized, hasCaseNodes: normalized.some(node => node.costStatus === 'not_individually_estimated'), modules: modules.map(item => ({ ...item, added: normalized.some(node => node.id === item.id) })), metrics, title: workflow.title, sourceLabel: workflow.sourceType === 'demo' ? '来自案例演示' : workflow.sourceType === 'case' ? '来自案例库' : '画布新建', missingText: missingLabels(metrics.missing).join(' / '), reducedMotion: getApp().globalData.reducedMotion })
  },
  toggleModule(event) {
    const id = event.currentTarget.dataset.id; const exists = this.data.nodes.some(node => node.id === id)
    const nodes = exists ? this.data.nodes.filter(node => node.id !== id) : this.data.nodes.concat({ ...modules.find(item => item.id === id), type: id })
    storage.write('canvasNodes', nodes); this.sync(nodes)
  },
  selectNode(event) { const node = event.detail.node || this.data.nodes.find(item => item.id === event.detail.id); if (node) this.setData({ selectedNode: node }) },
  closeNode() { this.setData({ selectedNode: null }) },
  toggleDrawer() { this.setData({ drawerOpen: !this.data.drawerOpen }) },
  reset() { wx.showModal({ title: '重置画布', content: '将清空当前所有节点，是否继续？', success: res => { if (res.confirm) { storage.write('canvasNodes', []); storage.write('activeWorkflow', createWorkflow({})); this.sync([]) } } }) },
  save() {
    const workflow = storage.read('activeWorkflow', createWorkflow({ nodes: this.data.nodes, metrics: this.data.metrics }))
    const id = workflow.schemeId || `scheme_${Date.now()}`
    const scheme = { ...workflow, id, workflowId: workflow.id, schemeId: id, nodes: this.data.nodes, metrics: this.data.metrics, createdAt: workflow.createdAt || Date.now(), updatedAt: Date.now() }
    storage.appendUnique('schemes', scheme)
    storage.write('activeWorkflow', updateWorkflow(workflow, { schemeId: id, nodes: this.data.nodes, metrics: this.data.metrics }))
    wx.showToast({ title: '方案已保存', icon: 'success' })
  },
  openValidation() {
    const open = () => wx.navigateTo({ url: '/pages/validation/validation' })
    if (this.data.metrics.canExport) return open()
    wx.showModal({
      title: '验证前仍有缺口',
      content: this.data.metrics.missing.length ? `建议先补齐：${this.data.missingText}。也可以先查看验证草案。` : '当前风险评分过高，建议先收紧承诺和合规边界。',
      confirmText: '查看草案',
      cancelText: '继续完善',
      success: res => { if (res.confirm) open() }
    })
  }
})
