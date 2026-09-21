const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const MAX_NICKNAME_LENGTH = 40
const MAX_AVATAR_LENGTH = 2048

function publicError(code, message) {
  return {
    ok: false,
    error: { code, message },
    message
  }
}

function optionalString(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string`)
  }

  const result = value.trim()
  if (result.length > maxLength) {
    throw new RangeError(`${field} is too long`)
  }
  return result
}

exports.main = async (event = {}) => {
  try {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      return publicError('INVALID_INPUT', '登录参数必须是对象')
    }

    const wxContext = cloud.getWXContext()
    if (!wxContext || !wxContext.OPENID) {
      return publicError(
        'WECHAT_CONTEXT_MISSING',
        '未获取到微信登录上下文，请从已初始化云开发的小程序调用 login 云函数'
      )
    }

    const nickname = optionalString(event.nickname, 'nickname', MAX_NICKNAME_LENGTH)
    const avatar = optionalString(event.avatar, 'avatar', MAX_AVATAR_LENGTH)

    // wx.cloud.callFunction already authenticates the caller. This value describes
    // that session; it is deliberately not a second, unverified bearer token.
    return {
      ok: true,
      token: null,
      authMode: 'wx_cloud_context',
      expiresAt: null,
      user: {
        id: wxContext.OPENID,
        nickname: nickname || '微信用户',
        avatar
      }
    }
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      return publicError('INVALID_INPUT', error.message)
    }

    console.error('login failed', { name: error && error.name })
    return publicError('LOGIN_FAILED', '登录服务暂时不可用，请稍后重试')
  }
}
