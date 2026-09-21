const { env } = require('./config/env')

App({
  globalData: {
    env,
    privacyAccepted: false,
    reducedMotion: false
  },

  onLaunch() {
    let device = {}
    try { device = wx.getDeviceInfo() } catch (error) {}
    this.globalData.reducedMotion = device.benchmarkLevel > 0 && device.benchmarkLevel < 12
    this.globalData.privacyAccepted = wx.getStorageSync('privacyAccepted') === true
  }
})
