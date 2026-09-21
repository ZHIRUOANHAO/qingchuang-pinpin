const { caseLibraryMeta } = require('../../data/cases')

Page({
  data: { caseLibraryMeta },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/profile/profile' }) }) },
  openFreeCases() { wx.setStorageSync('caseAccess', 'all'); wx.switchTab({ url: '/pages/cases/cases' }) }
})
