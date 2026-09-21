const storage = require('../utils/storage')
const { env } = require('../config/env')

function restoreSession() {
  const session = storage.read('session')
  if (!session) return null
  if (session.expiresAt && session.expiresAt <= Date.now()) {
    logout()
    return null
  }
  const profile = storage.read('userProfile', {})
  return { ...session, user: { ...(session.user || {}), ...profile } }
}

function normalizeProfile(profile = {}) {
  const nickname = typeof profile.nickname === 'string' ? profile.nickname.trim().slice(0, 24) : ''
  const avatar = typeof profile.avatar === 'string' ? profile.avatar.trim().slice(0, 2048) : ''
  const role = ['创业实践者', '商业学习者', '家庭陪学者'].includes(profile.role) ? profile.role : '创业实践者'
  return { nickname, avatar, role }
}

function syncApp(session) {
  try {
    const app = getApp()
    app.globalData.session = session
    app.globalData.user = session ? session.user : null
  } catch (error) {}
}

function persistSession(session) {
  storage.write('session', session)
  if (session && session.user) storage.write('userProfile', session.user)
  syncApp(session)
  return session
}

async function uploadAvatar(avatar, userId) {
  if (!avatar || env.mockMode || !wx.cloud || avatar.startsWith('cloud://')) return avatar
  const isTemporary = avatar.startsWith('wxfile://') || /^https?:\/\/tmp\//.test(avatar) || avatar.startsWith('/')
  if (/^https?:\/\//.test(avatar) && !isTemporary) return avatar
  const extension = (avatar.match(/\.([a-zA-Z0-9]+)(?:\?|$)/) || [null, 'jpg'])[1]
  const cloudPath = `user-avatars/${userId || 'user'}/${Date.now()}.${extension}`
  const result = await wx.cloud.uploadFile({ cloudPath, filePath: avatar })
  return result.fileID || avatar
}

async function login(profile = {}) {
  const storedProfile = storage.read('userProfile', {})
  const incomingProfile = normalizeProfile(profile)
  const localProfile = {
    nickname: incomingProfile.nickname || storedProfile.nickname || '',
    avatar: incomingProfile.avatar || storedProfile.avatar || '',
    role: profile.role ? incomingProfile.role : (storedProfile.role || '创业实践者')
  }
  if (env.mockMode || !wx.cloud) {
    const session = {
      token: `mock_${Date.now()}`,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      authMode: 'local_demo',
      user: {
        id: 'demo-user',
        nickname: localProfile.nickname || '轻创实践者',
        avatar: localProfile.avatar || '',
        role: localProfile.role || '创业实践者'
      }
    }
    return persistSession(session)
  }

  const result = await wx.cloud.callFunction({ name: 'login', data: localProfile })
  const session = result.result
  if (!session || session.ok === false) throw new Error(session && session.message ? session.message : '登录失败')
  session.user = {
    ...(session.user || {}),
    ...(localProfile.nickname ? { nickname: localProfile.nickname } : {}),
    ...(localProfile.avatar ? { avatar: localProfile.avatar } : {}),
    role: localProfile.role,
    id: session.user && session.user.id
  }
  try {
    const profileResult = await wx.cloud.callFunction({ name: 'userProfile', data: { action: 'get' } })
    if (profileResult.result && profileResult.result.ok && profileResult.result.user) session.user = { ...session.user, ...profileResult.result.user }
  } catch (error) {}
  return persistSession(session)
}

function logout() {
  wx.removeStorageSync('session')
  syncApp(null)
}

async function updateProfile(profile = {}) {
  const current = restoreSession()
  if (!current) throw new Error('请先登录')
  const normalized = normalizeProfile(profile)
  if (!normalized.nickname) throw new Error('请输入昵称')
  normalized.avatar = await uploadAvatar(normalized.avatar, current.user && current.user.id)

  let user = { ...(current.user || {}), ...normalized }
  if (!env.mockMode && wx.cloud) {
    const result = await wx.cloud.callFunction({ name: 'userProfile', data: { action: 'update', profile: normalized } })
    const response = result.result
    if (!response || response.ok === false) throw new Error(response && response.message ? response.message : '资料保存失败')
    user = { ...user, ...(response.user || {}) }
  }
  persistSession({ ...current, user })
  return user
}

async function deleteAccount() {
  const current = restoreSession()
  if (current && !env.mockMode && wx.cloud) {
    const result = await wx.cloud.callFunction({ name: 'userProfile', data: { action: 'delete' } })
    if (!result.result || result.result.ok === false) throw new Error(result.result && result.result.message ? result.result.message : '账号注销失败')
  }
  ;['session', 'userProfile', 'membership', 'favorites', 'analysisRecords', 'schemes', 'orders'].forEach(key => wx.removeStorageSync(key))
  syncApp(null)
}

function requireLogin(next) {
  const app = getApp()
  if (app.globalData.session) return true
  wx.navigateTo({ url: `/pages/login/login?next=${encodeURIComponent(next || '')}` })
  return false
}

module.exports = { restoreSession, login, logout, updateProfile, deleteAccount, requireLogin }
