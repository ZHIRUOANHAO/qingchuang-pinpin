const storage = require('../../utils/storage'); Page({ data: { list: [] }, onShow() { this.setData({ list: storage.read('favorites', []) }) }, open(event) { wx.navigateTo({ url: `/pages/case-detail/case-detail?id=${event.currentTarget.dataset.id}` }) } })

