const storage = require('../../utils/storage')
const { dateTime } = require('../../utils/format')
const { calculate } = require('../../utils/scoring')
const { createWorkflow } = require('../../utils/validation')

Page({
  data: { list: [] },
  onShow() { this.setData({ list: storage.read('analysisRecords', []).map(item => ({ ...item, time: dateTime(item.createdAt) })) }) },
  activate(index) {
    const record = this.data.list[index]
    const workflow = createWorkflow({ ...record, metrics: calculate(record.nodes || []), sourceType: 'demo', sourceId: record.id })
    storage.write('activeWorkflow', workflow)
    storage.write('canvasNodes', workflow.nodes)
  },
  continueCanvas(event) { this.activate(event.currentTarget.dataset.index); wx.switchTab({ url: '/pages/canvas/canvas' }) },
  openValidation(event) { this.activate(event.currentTarget.dataset.index); wx.navigateTo({ url: '/pages/validation/validation' }) }
})
