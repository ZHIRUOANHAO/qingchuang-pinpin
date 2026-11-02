const onboarding = require('../../../services/onboarding')

Page({
  data: {
    videoMounted: true,
    videoSrc: '',
    videoLoading: true,
    videoError: false,
    completed: false,
    steps: [
      { number: '01', title: '选一个案例', description: '从「低成本试做」开始，找一个自己能理解、感兴趣的方向。' },
      { number: '02', title: '看懂具体做法', description: '先看卖什么、谁愿意买、如何交付，再查看来源和风险说明。' },
      { number: '03', title: '把做法加入画布', description: '选择想借鉴的阶段资产卡，加入画布，整理自己的思路。' },
      { number: '04', title: '写下第一步验证', description: '形成验证方案，先做一个小尝试，再记录实际结果。方案只保存在本机。' }
    ]
  },
  onLoad() { this.alive = true; onboarding.dismiss('opened'); this.prepareVideo() },
  onHide() { this.pauseVideo() },
  onUnload() { this.alive = false; this.pauseVideo() },
  prepareVideo() {
    const request = (this.videoRequest || 0) + 1
    this.videoRequest = request
    this.setData({ videoMounted: true, videoSrc: '', videoLoading: true, videoError: false })
    const current = () => this.alive && this.videoRequest === request
    const fail = () => { if (current()) this.setData({ videoLoading: false, videoError: true }) }
    try {
      const files = wx.getFileSystemManager()
      const destination = `${wx.env.USER_DATA_PATH}/qcpp-onboarding-quickstart-v1.mp4`
      files.readFile({
        filePath: '/onboarding/media/quickstart.mp4',
        success: result => {
          if (!current()) return
          files.writeFile({ filePath: destination, data: result.data,
            success: () => { if (current()) this.setData({ videoSrc: destination, videoLoading: false }) }, fail })
        }, fail
      })
    } catch (error) { fail() }
  },
  pauseVideo() { try { wx.createVideoContext('quickstart-video', this).pause() } catch (error) {} },
  videoFailed() { this.setData({ videoError: true }) },
  videoEnded() { onboarding.dismiss('completed'); this.setData({ completed: true }) },
  retryVideo() { this.setData({ videoMounted: false }, () => this.prepareVideo()) },
  leaveGuide() {
    this.pauseVideo()
    onboarding.dismiss(this.data.completed ? 'completed' : 'skipped')
    wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/home/home' }) })
  },
  startCases() {
    this.pauseVideo()
    try { wx.setStorageSync('caseAccess', 'starter') } catch (error) {
      wx.showToast({ title: '本机存储不可用，将打开全部案例', icon: 'none' })
    }
    onboarding.dismiss(this.data.completed ? 'completed' : 'opened')
    wx.switchTab({ url: '/pages/cases/cases', fail: () => wx.showToast({ title: '打开失败，请稍后重试', icon: 'none' }) })
  }
})
