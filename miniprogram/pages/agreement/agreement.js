const { env } = require('../../config/env')

function isConfiguredEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/@example\.(com|org|net)$/i.test(value)
}

Page({
  data: {
    updatedAt: '2026-09-21',
    supportEmail: isConfiguredEmail(env.supportEmail) ? env.supportEmail : '',
    supportReady: isConfiguredEmail(env.supportEmail)
  },
  copyContact() { if (this.data.supportReady) wx.setClipboardData({ data: this.data.supportEmail }) }
})
