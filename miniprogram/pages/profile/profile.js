const storage = require('../../utils/storage')
const share = require('../../services/share')

Page({
  data: {
    counts: { favorites: 0, records: 0, schemes: 0 },
    menus: [
      { id: 'favorites', name: '我的收藏', note: '仅保存在当前设备', symbol: '◇', url: '/pages/favorites/favorites' },
      { id: 'records', name: '案例演示记录', note: '回看已保存的案例结构', symbol: 'DNA', url: '/pages/records/records' },
      { id: 'schemes', name: '方案与验证', note: '继续拼装、执行与阶段复盘', symbol: '□', url: '/pages/schemes/schemes' }
    ]
  },

  onShow() {
    this.setData({
      counts: {
        favorites: storage.read('favorites', []).length,
        records: storage.read('analysisRecords', []).length,
        schemes: storage.read('schemes', []).length
      }
    })
  },

  openMenu(event) { wx.navigateTo({ url: event.currentTarget.dataset.url }) },
  openSettings() { wx.openSetting({ fail: () => wx.showToast({ title: '请在微信设置中管理权限', icon: 'none' }) }) },
  shareMini() { wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }); wx.showToast({ title: '点击右上角分享', icon: 'none' }) },
  onShareAppMessage() { return share.pageMessage('轻创拼拼｜轻创业案例与商业 DNA', '/pages/home/home') }
})
