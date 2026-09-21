const storage = require('../../utils/storage')

Component({
  properties: { node: { type: Object, value: null } },
  methods: {
    close() { this.triggerEvent('close') },
    noop() {},
    saveStage() {
      if (!this.data.node) return
      storage.appendUnique('savedStages', { ...this.data.node, savedAt: Date.now() })
      this.triggerEvent('save', { node: this.data.node })
      wx.showToast({ title: '阶段已保存到本机', icon: 'success' })
    }
  }
})
