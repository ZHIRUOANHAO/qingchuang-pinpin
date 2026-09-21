const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const users = db.collection('users')
const roles = ['创业实践者', '商业学习者', '家庭陪学者']

function response(ok, data = {}) {
  return { ok, ...data }
}

function normalize(profile = {}) {
  const nickname = typeof profile.nickname === 'string' ? profile.nickname.trim().slice(0, 24) : ''
  const avatar = typeof profile.avatar === 'string' ? profile.avatar.trim().slice(0, 2048) : ''
  const role = roles.includes(profile.role) ? profile.role : '创业实践者'
  if (!nickname) throw new Error('请输入昵称')
  return { nickname, avatar, role }
}

function publicUser(record, openid) {
  return {
    id: openid,
    nickname: record.nickname || '微信用户',
    avatar: record.avatar || '',
    role: roles.includes(record.role) ? record.role : '创业实践者'
  }
}

exports.main = async (event = {}) => {
  const context = cloud.getWXContext()
  const openid = context && context.OPENID
  if (!openid) return response(false, { message: '未获取到微信登录上下文' })

  const action = event.action || 'get'
  try {
    const query = await users.where({ _openid: openid }).limit(1).get()
    const current = query.data && query.data[0]

    if (action === 'get') {
      return response(true, { user: publicUser(current || {}, openid), exists: Boolean(current) })
    }

    if (action === 'update') {
      const profile = normalize(event.profile)
      if (current) {
        await users.doc(current._id).update({ data: { ...profile, updatedAt: db.serverDate() } })
      } else {
        await users.add({ data: { _openid: openid, ...profile, createdAt: db.serverDate(), updatedAt: db.serverDate() } })
      }
      return response(true, { user: publicUser(profile, openid) })
    }

    if (action === 'delete') {
      if (current) await users.doc(current._id).remove()
      return response(true, { deleted: true })
    }

    return response(false, { message: '不支持的账号操作' })
  } catch (error) {
    console.error('userProfile failed', { action, name: error && error.name })
    return response(false, { message: action === 'get' ? '个人资料读取失败' : '个人资料处理失败' })
  }
}
