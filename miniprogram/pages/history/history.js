const history = require('../../utils/case-history')

function displayList(list) {
  return list.map(item => {
    const date = new Date(item.time)
    const pad = value => String(value).padStart(2, '0')
    const viewedAt = item.time ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}` : '较早浏览'
    return { ...item, viewedAt }
  })
}

Page({
  data: { list: [], error: false },
  onShow() { this.loadHistory() },
  onUnload() { this.disposed = true },
  loadHistory() {
    try { this.setData({ list: displayList(history.getRecentCases()), error: false }) }
    catch (error) { this.setData({ list: [], error: true }) }
  },
  open(event) { wx.navigateTo({ url: `/pages/case-detail/case-detail?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }) },
  browseCases() { wx.switchTab({ url: '/pages/cases/cases' }) },
  remove(event) {
    try {
      const list = history.removeRecentCase(event.currentTarget.dataset.id)
      this.setData({ list: displayList(list), error: false })
      wx.showToast({ title: '已移除浏览记录', icon: 'none' })
    } catch (error) { wx.showToast({ title: '移除失败，请重试', icon: 'none' }) }
  },
  clearHistory() {
    wx.showModal({
      title: '清空最近浏览？', content: '只清空本机浏览足迹，不影响搜索词、收藏和验证方案。', confirmText: '清空',
      success: result => {
        if (!result.confirm || this.disposed) return
        try {
          this.setData({ list: history.clearRecentCases(), error: false })
          wx.showToast({ title: '已清空浏览记录', icon: 'none' })
        } catch (error) { wx.showToast({ title: '清空失败，请重试', icon: 'none' }) }
      }
    })
  }
})
