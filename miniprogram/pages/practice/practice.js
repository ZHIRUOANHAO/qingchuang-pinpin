const { starterExercises, findStarterExercise } = require('../../data/starter-exercises')
const { findCaseSummary } = require('../../data/case-summaries')
const feedback = require('../../utils/practice-feedback')

Page({
  data: {
    exercises: starterExercises, exerciseIndex: 0, exercise: null, record: null,
    lockedSource: false, dirty: false, errors: {}, errorMessage: '', pageError: '', savedMessage: '',
    outcomeOptions: ['尚不确定', '达到预期', '部分有效', '未达预期'],
    outcomeValues: ['unknown', 'worked', 'mixed', 'failed'], outcomeIndex: 0,
    typeLabels: feedback.TYPE_LABELS
  },
  onLoad(options = {}) {
    try {
      if (options.recordId) {
        const record = feedback.getRecord(options.recordId)
        if (!record) return this.setData({ pageError: '这条本机记录不存在，可能已经删除。请返回记录列表查看。' })
        this.setRecord(record, findStarterExercise(record.exerciseId), true)
      } else if (options.exerciseId) {
        const exercise = findStarterExercise(options.exerciseId)
        if (!exercise) return this.setData({ pageError: '找不到这个入门练习，请返回重新选择。' })
        this.startExercise(exercise)
      } else if (options.caseId) {
        const item = findCaseSummary(options.caseId)
        if (!item) return this.setData({ pageError: '找不到这个案例，请返回案例库重新选择。' })
        this.setRecord(feedback.createRecord({ caseId: item.id, caseTitle: item.title }), null, true)
      } else this.startExercise(starterExercises[0])
    } catch (error) { this.setData({ pageError: error.message || '暂时无法打开本机记录，请稍后重试。' }) }
  },
  setRecord(record, exercise, lockedSource) {
    this.setData({ record, exercise, lockedSource, exerciseIndex: Math.max(0, starterExercises.findIndex(item => item.id === record.exerciseId)), outcomeIndex: Math.max(0, this.data.outcomeValues.indexOf(record.outcome)), errors: {}, errorMessage: '', savedMessage: '', dirty: false })
  },
  startExercise(exercise) {
    const item = findCaseSummary(exercise.caseId)
    if (!item) return this.setData({ pageError: '练习的参考案例暂不可用，请稍后再试。' })
    this.setRecord(feedback.createRecord({ caseId: item.id, caseTitle: item.title, exerciseId: exercise.id, exerciseTitle: exercise.title }), exercise, false)
  },
  changeExercise(event) {
    const exercise = starterExercises[Number(event.detail.value)]
    if (!exercise || exercise.id === this.data.record.exerciseId) return
    if (this.data.dirty) {
      wx.showModal({ title: '切换练习？', content: '当前填写内容尚未保存。切换后将清空表单；你也可以取消，先暂存草稿。', confirmText: '切换练习', success: result => { if (result.confirm) { this.startExercise(exercise); this.setUnloadGuard(false) } } })
    } else this.startExercise(exercise)
  },
  setUnloadGuard(enabled) {
    if (enabled && typeof wx.enableAlertBeforeUnload === 'function') wx.enableAlertBeforeUnload({ message: '当前记录尚未保存，离开前可先暂存草稿。' })
    if (!enabled && typeof wx.disableAlertBeforeUnload === 'function') wx.disableAlertBeforeUnload()
  },
  markDirty(changes) {
    this.setData(Object.assign({ dirty: true, savedMessage: '', errors: {}, errorMessage: '' }, changes))
    this.setUnloadGuard(true)
  },
  inputField(event) {
    const field = event.currentTarget.dataset.field
    if (!Object.prototype.hasOwnProperty.call(feedback.TEXT_LIMITS, field) || !['action', 'period', 'context', 'result', 'evidence', 'evidenceUrl', 'comment'].includes(field)) return
    this.markDirty({ [`record.${field}`]: event.detail.value })
  },
  changeType(event) {
    const type = event.currentTarget.dataset.type
    if (type === 'practice' || type === 'question') this.markDirty({ 'record.type': type })
  },
  changeOutcome(event) {
    const index = Number(event.detail.value)
    if (this.data.outcomeValues[index]) this.markDirty({ outcomeIndex: index, 'record.outcome': this.data.outcomeValues[index] })
  },
  saveDraft() { this.save(false) },
  saveComplete() { this.save(true) },
  save(complete) {
    try {
      const record = feedback.saveRecord(this.data.record, { complete })
      this.setData({ record, lockedSource: true, dirty: false, errors: {}, errorMessage: '', savedMessage: complete ? '记录已保存到本机，可到“我的记录”查看和继续编辑。' : '草稿已暂存在本机，可以稍后继续补充。' })
      this.setUnloadGuard(false)
      wx.showToast({ title: complete ? '本机记录已保存' : '本机草稿已保存', icon: 'success' })
    } catch (error) {
      const errors = error.errors || {}
      this.setData({ errors, errorMessage: Object.keys(errors).length ? Object.keys(errors).map(field => errors[field]).join(' ') : error.message || '保存失败，当前内容仍在表单中。', savedMessage: '' })
      wx.showToast({ title: '尚未保存，请看提示', icon: 'none' })
    }
  },
  copyCurrent() {
    try {
      const record = feedback.createRecord(Object.assign({}, this.data.record, { status: 'draft' }))
      wx.setClipboardData({ data: feedback.exportRecord(record), success: () => wx.showToast({ title: '摘要已复制', icon: 'success' }), fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }) })
    } catch (error) { this.setData({ errorMessage: error.message || '暂时无法复制，请先检查表单。' }) }
  },
  leave(url) {
    const go = () => { this.setUnloadGuard(false); wx.navigateTo({ url }) }
    if (this.data.dirty) wx.showModal({ title: '还有内容未保存', content: '可以取消后暂存草稿，也可以离开并放弃本次修改。', confirmText: '放弃修改', success: result => { if (result.confirm) go() } })
    else go()
  },
  viewReference() { if (this.data.record) this.leave(`/pages/case-detail/case-detail?id=${encodeURIComponent(this.data.record.caseId)}`) },
  viewRecords() { this.leave('/pages/practice-records/practice-records') },
  back() {
    const go = () => { this.setUnloadGuard(false); wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) }) }
    if (this.data.dirty) wx.showModal({ title: '还有内容未保存', content: '可以取消后暂存草稿，也可以返回并放弃本次修改。', confirmText: '放弃修改', success: result => { if (result.confirm) go() } })
    else go()
  }
})
