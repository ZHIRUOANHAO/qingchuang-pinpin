const auth = require('../../services/auth')

Page({
  data: {
    session: null,
    nickname: '',
    avatarInitial: 'Q',
    avatar: '',
    role: '创业实践者',
    roles: ['创业实践者', '商业学习者', '家庭陪学者'],
    accountId: '--',
    authLabel: '未连接',
    membership: '免费体验',
    saving: false
  },

  onShow() {
    const session = auth.restoreSession()
    const user = session && session.user || {}
    this.setData({
      session,
      nickname: user.nickname || '',
      avatarInitial: (user.nickname || 'Q').slice(0, 1),
      avatar: user.avatar || '',
      role: user.role || '创业实践者',
      accountId: user.id ? user.id.slice(-8).toUpperCase() : '--',
      authLabel: session ? (session.authMode === 'local_demo' ? '本地演示账号' : '微信云登录') : '未连接',
      membership: '免费体验'
    })
  },

  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/profile/profile' }) }) },
  login() { wx.navigateTo({ url: `/pages/login/login?next=${encodeURIComponent('/pages/account/account')}` }) },
  onChooseAvatar(event) { this.setData({ avatar: event.detail.avatarUrl || '' }) },
  onNicknameInput(event) { const nickname = event.detail.value; this.setData({ nickname, avatarInitial: (nickname || 'Q').slice(0, 1) }) },
  selectRole(event) { this.setData({ role: event.currentTarget.dataset.role }) },

  async save() {
    if (!this.data.session) return this.login()
    this.setData({ saving: true })
    try {
      const user = await auth.updateProfile({ nickname: this.data.nickname, avatar: this.data.avatar, role: this.data.role })
      this.setData({ nickname: user.nickname, avatar: user.avatar, role: user.role, avatarInitial: (user.nickname || 'Q').slice(0, 1) })
      wx.showToast({ title: '资料已保存', icon: 'success' })
    } catch (error) {
      wx.showModal({ title: '保存失败', content: error.message || '请稍后重试', showCancel: false })
    } finally {
      this.setData({ saving: false })
    }
  },

  logout() {
    wx.showModal({
      title: '退出当前账号',
      content: '本机保存的案例与方案不会删除，重新登录后仍可继续使用。',
      confirmText: '退出登录',
      success: result => {
        if (!result.confirm) return
        auth.logout()
        wx.showToast({ title: '已退出登录', icon: 'none' })
        setTimeout(() => wx.switchTab({ url: '/pages/profile/profile' }), 350)
      }
    })
  },

  deleteAccount() {
    wx.showModal({
      title: '注销账号并清除数据',
      content: '将清除个人资料、收藏、拆解记录、方案和本机订单记录。该操作不可恢复。',
      confirmText: '确认注销',
      confirmColor: '#ef7d83',
      success: async result => {
        if (!result.confirm) return
        try {
          await auth.deleteAccount()
          wx.showToast({ title: '账号已注销', icon: 'success' })
          setTimeout(() => wx.switchTab({ url: '/pages/profile/profile' }), 400)
        } catch (error) {
          wx.showModal({ title: '注销失败', content: error.message || '请稍后重试', showCancel: false })
        }
      }
    })
  },

  privacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) }
})
