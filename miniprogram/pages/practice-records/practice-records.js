const feedback = require('../../utils/practice-feedback')
const { findCaseSummary } = require('../../data/case-summaries')

function dateLabel(value) {
  const date = new Date(value)
  const two = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`
}

Page({
  data: { records: [], type: '', status: '', caseId: '', caseTitle: '', errorMessage: '', statusLabels: { draft: '本机草稿', record: '本机记录' }, outcomeLabels: feedback.OUTCOME_LABELS, typeLabels: feedback.TYPE_LABELS },
  onLoad(options = {}) {
    const item = options.caseId ? findCaseSummary(options.caseId) : null
    this.setData({ caseId: item ? item.id : '', caseTitle: item ? item.title : '' })
    if (options.caseId && !item) this.setData({ errorMessage: '找不到指定案例，已显示全部本机记录。' })
  },
  onShow() { this.refresh() },
  refresh() {
    try {
      const records = feedback.listRecords({ caseId: this.data.caseId, type: this.data.type, status: this.data.status }).map(record => Object.assign({}, record, { displayTime: dateLabel(record.updatedAt), displayTitle: record.exerciseTitle || record.caseTitle, excerpt: (record.type === 'question' ? record.comment : record.result || record.action) || '尚未填写，继续编辑补充。' }))
      this.setData({ records, errorMessage: '' })
    } catch (error) { this.setData({ records: [], errorMessage: error.message || '暂时无法读取本机记录，请重试。' }) }
  },
  filterType(event) { this.setData({ type: event.currentTarget.dataset.value }); this.refresh() },
  filterStatus(event) { this.setData({ status: event.currentTarget.dataset.value }); this.refresh() },
  clearCaseFilter() { this.setData({ caseId: '', caseTitle: '' }); this.refresh() },
  editRecord(event) { wx.navigateTo({ url: `/pages/practice/practice?recordId=${encodeURIComponent(event.currentTarget.dataset.id)}` }) },
  newRecord() { wx.navigateTo({ url: '/pages/practice/practice' + (this.data.caseId ? `?caseId=${encodeURIComponent(this.data.caseId)}` : '') }) },
  copyRecord(event) {
    try {
      const record = feedback.getRecord(event.currentTarget.dataset.id)
      if (!record) { this.refresh(); return wx.showToast({ title: '记录已不存在', icon: 'none' }) }
      wx.setClipboardData({ data: feedback.exportRecord(record), success: () => wx.showToast({ title: '摘要已复制', icon: 'success' }), fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }) })
    } catch (error) { this.setData({ errorMessage: error.message || '复制失败，请稍后重试。' }) }
  },
  deleteRecord(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({ title: '删除这条本机记录？', content: '删除后无法恢复。如果需要留存，请先取消并复制摘要。', confirmText: '确认删除', confirmColor: '#c24650', success: result => {
      if (!result.confirm) return
      try {
        const removed = feedback.removeRecord(id)
        this.refresh()
        wx.showToast({ title: removed ? '已删除本机记录' : '记录已不存在', icon: removed ? 'success' : 'none' })
      } catch (error) { this.setData({ errorMessage: error.message || '删除失败，原记录仍保留。' }) }
    } })
  },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/profile/profile' }) }) }
})
