const storage = require('../../utils/storage')
const { buildNodeMap } = require('../../utils/asset-map')

Component({
  properties: { node: { type: Object, value: null } },
  data: { detailMap: null },
  observers: {
    node(node) { this.setData({ detailMap: node ? buildNodeMap(node) : null }) }
  },
  methods: {
    close() { this.triggerEvent('close') },
    noop() {},
    saveStage() {
      if (!this.data.node) return
      try {
        storage.appendUnique('savedStages', { ...this.data.node, savedAt: Date.now() })
      } catch (error) {
        wx.showToast({ title: '保存失败，请检查本机存储空间', icon: 'none' })
        return
      }
      this.triggerEvent('save', { node: this.data.node })
      wx.showToast({ title: '阶段已保存到本机', icon: 'success' })
    }
  }
})
