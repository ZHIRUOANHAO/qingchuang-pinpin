const storage = require('../../utils/storage')

function visibleFavorites(value) {
  return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string') : []
}

Page({
  data: { list: [], error: false },
  onShow() { this.loadFavorites() },
  onUnload() { this.disposed = true },
  loadFavorites() {
    try { this.setData({ list: visibleFavorites(storage.read('favorites', [])), error: false }) }
    catch (error) { this.setData({ list: [], error: true }) }
  },
  open(event) { wx.navigateTo({ url: `/pages/case-detail/case-detail?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }) },
  browseCases() { wx.switchTab({ url: '/pages/cases/cases' }) },
  removeFavorite(event) {
    const id = event.currentTarget.dataset.id
    try {
      const next = visibleFavorites(storage.read('favorites', [])).filter(item => item.id !== id)
      storage.write('favorites', next)
      this.setData({ list: next, error: false })
      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } catch (error) { wx.showToast({ title: '取消失败，请重试', icon: 'none' }) }
  },
  clearFavorites() {
    wx.showModal({
      title: '清空全部收藏？', content: '只清空本机收藏，不影响浏览记录、画布和验证方案。', confirmText: '清空',
      success: result => {
        if (!result.confirm || this.disposed) return
        try {
          storage.write('favorites', [])
          this.setData({ list: [], error: false })
          wx.showToast({ title: '已清空收藏', icon: 'none' })
        } catch (error) { wx.showToast({ title: '清空失败，请重试', icon: 'none' }) }
      }
    })
  }
})

