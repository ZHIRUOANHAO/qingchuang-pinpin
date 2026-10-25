const { env } = require('../../config/env')

function isConfiguredEmail(value) {
  return typeof value === 'string'
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    && !/@example\.(com|org|net)$/i.test(value)
}

Page({
  data: {
    policyVersion: env.privacyPolicyVersion || '待确认',
    updatedAt: '2026-09-21',
    supportEmail: isConfiguredEmail(env.supportEmail) ? env.supportEmail : '',
    supportReady: isConfiguredEmail(env.supportEmail),
    entityName: typeof env.entityName === 'string' ? env.entityName.trim() : '',
    icpNumber: typeof env.icpNumber === 'string' ? env.icpNumber.trim() : ''
  },

  copyContact() {
    if (!this.data.supportReady) return
    wx.setClipboardData({ data: this.data.supportEmail })
  },

  openAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' })
  },

  openMinors() {
    wx.navigateTo({ url: '/pages/minors/minors' })
  },

  clearLocalData() {
    const keys = ['favorites', 'analysisRecords', 'savedCases', 'schemes', 'validationRuns', 'activeWorkflow', 'canvasNodes', 'privacyAccepted']
    wx.showModal({
      title: '清除本机记录',
      content: '将删除收藏、案例演示记录、画布与验证方案，且无法恢复。是否继续？',
      confirmText: '确认清除',
      confirmColor: '#c66f76',
      success: result => {
        if (!result.confirm) return
        keys.forEach(key => wx.removeStorageSync(key))
        getApp().globalData.privacyAccepted = false
        wx.showToast({ title: '本机记录已清除', icon: 'success' })
      }
    })
  }
})
