const storage = require('../../utils/storage')
const { dateTime } = require('../../utils/format')
const { calculate } = require('../../utils/scoring')
const { createWorkflow } = require('../../utils/validation')

Page({
  data: { list: [] },
  onShow() { this.refresh() },
  refresh() { this.setData({ list: storage.read('schemes', []).map(item => ({ ...item, time: dateTime(item.updatedAt || item.createdAt) })) }) },
  activate(index) {
    const scheme = this.data.list[index]
    const workflow = createWorkflow({ ...scheme, metrics: calculate(scheme.nodes || []), workflowId: scheme.workflowId || scheme.id, schemeId: scheme.id })
    storage.write('activeWorkflow', workflow)
    storage.write('canvasNodes', workflow.nodes)
    return workflow
  },
  edit(event) { this.activate(event.currentTarget.dataset.index); wx.switchTab({ url: '/pages/canvas/canvas' }) },
  openValidation(event) { this.activate(event.currentTarget.dataset.index); wx.navigateTo({ url: '/pages/validation/validation' }) },
  remove(event) {
    const scheme = this.data.list[event.currentTarget.dataset.index]
    wx.showModal({ title: '删除方案', content: `确认删除“${scheme.title}”吗？`, success: res => { if (res.confirm) { storage.removeById('schemes', scheme.id); this.refresh() } } })
  }
})
