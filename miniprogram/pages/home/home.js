const { caseSummaries, caseLibraryMeta } = require('../../data/case-summaries')
const share = require('../../services/share')
const ads = require('../../config/ads')

Page({
  data: {
    cases: caseSummaries.map(item => ({ id: item.id, title: item.title, planet: item.planet })),
    caseLibraryMeta,
    recommendation: caseSummaries[0],
    reducedMotion: false,
    orbitPaused: false,
    showPrivacy: false,
    adSlot: ads.getSlot('homeFeed')
  },
  onLoad() {
    this.setData({ reducedMotion: getApp().globalData.reducedMotion, showPrivacy: !getApp().globalData.privacyAccepted })
  },
  onPullDownRefresh() { setTimeout(() => wx.stopPullDownRefresh(), 450) },
  selectPlanet(event) { if (event.detail.id === 'core') this.openCases(); else if (event.detail.id) wx.navigateTo({ url: `/pages/case-detail/case-detail?id=${event.detail.id}` }) },
  openCase(event) { wx.navigateTo({ url: `/pages/case-detail/case-detail?id=${event.currentTarget.dataset.id}` }) },
  openFeatured() { wx.navigateTo({ url: `/pages/case-detail/case-detail?id=${this.data.recommendation.id}` }) },
  openDemo() { wx.switchTab({ url: '/pages/ai/ai' }) },
  openCanvas() { wx.switchTab({ url: '/pages/canvas/canvas' }) },
  openCases() { wx.switchTab({ url: '/pages/cases/cases' }) },
  openStarterCases() { wx.setStorageSync('caseAccess', 'starter'); wx.switchTab({ url: '/pages/cases/cases' }) },
  toggleOrbit() { if (!this.data.reducedMotion) this.setData({ orbitPaused: !this.data.orbitPaused }) },
  resetOrbitView() { const scene = this.selectComponent('#universeScene'); if (scene) scene.resetView() },
  acceptPrivacy() { this.setData({ showPrivacy: false }) },
  declinePrivacy() { this.setData({ showPrivacy: false }); wx.showToast({ title: '已关闭提示，下次打开会再次说明', icon: 'none' }) },
  onShareAppMessage() { return share.pageMessage('轻创拼拼：100 条轻创业案例与商业 DNA', '/pages/home/home') },
  onShareTimeline() { return share.timelineMessage('看懂商业结构，从公开案例开始验证') }
})
