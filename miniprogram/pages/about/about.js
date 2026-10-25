const { env } = require('../../config/env')

Page({
  data: {
    entityName: typeof env.entityName === 'string' ? env.entityName.trim() : '',
    icpNumber: typeof env.icpNumber === 'string' ? env.icpNumber.trim() : ''
  },
  openLegal(event) { wx.navigateTo({ url: event.currentTarget.dataset.url }) }
})
