Component({
  properties: { visible: { type: Boolean, value: false } },
  methods: {
    openPolicy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) },
    decline() { this.triggerEvent('decline') },
    accept() {
      wx.setStorageSync('privacyAccepted', true)
      getApp().globalData.privacyAccepted = true
      this.triggerEvent('accept')
    }
  }
})

