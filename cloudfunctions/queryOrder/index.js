const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const ORDER_COLLECTION = 'orders'
const FINAL_STATUSES = new Set(['paid', 'closed', 'refunded', 'mock_paid'])

class AppError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

function cleanOrderId(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('INVALID_INPUT', 'orderId 不能为空')
  }
  const orderId = value.trim()
  if (orderId.length > 32 || !/^[A-Za-z0-9_-]+$/.test(orderId)) {
    throw new AppError('INVALID_INPUT', 'orderId 格式无效')
  }
  return orderId
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new AppError('PAYMENT_CONFIG_MISSING', `缺少服务端环境变量 ${name}`)
  }
  return value.trim()
}

function field(object, camel, snake) {
  return object && (object[camel] !== undefined ? object[camel] : object[snake])
}

function toInteger(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return NaN
}

function publicOrder(order) {
  return {
    orderId: order.orderId,
    productId: order.productId,
    productName: order.productName,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    mock: order.paymentMode === 'mock',
    paymentVerified: order.paymentVerified === true,
    transactionId: order.transactionId || undefined,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt || undefined
  }
}

async function getOrder(orderId) {
  try {
    const result = await cloud.database().collection(ORDER_COLLECTION).doc(orderId).get()
    return result.data
  } catch (error) {
    const message = String((error && (error.errMsg || error.message)) || '')
    if (/not exist|not found|DATABASE_REQUEST_FAILED/i.test(message)) {
      throw new AppError('ORDER_NOT_FOUND', '订单不存在')
    }
    console.error('order query failed', { name: error && error.name })
    throw new AppError('ORDER_STORAGE_UNAVAILABLE', '订单查询暂时不可用')
  }
}

async function refreshWechatOrder(order) {
  const subMchId = requireEnv('WECHAT_SUB_MCH_ID')
  let response
  try {
    response = await cloud.cloudPay.queryOrder({
      sub_mch_id: subMchId,
      out_trade_no: order.outTradeNo,
      nonce_str: crypto.randomBytes(16).toString('hex')
    })
  } catch (error) {
    console.error('wechat order query failed', { name: error && error.name })
    throw new AppError('WECHAT_ORDER_QUERY_FAILED', '微信支付订单查询失败，请稍后重试')
  }

  if (field(response, 'returnCode', 'return_code') !== 'SUCCESS') {
    throw new AppError('WECHAT_ORDER_QUERY_FAILED', '微信支付订单查询失败，请稍后重试')
  }

  const tradeState = field(response, 'tradeState', 'trade_state')
  let update = null
  if (tradeState === 'SUCCESS') {
    const actualAmount = toInteger(field(response, 'totalFee', 'total_fee'))
    if (actualAmount !== order.amount) {
      update = {
        status: 'payment_review',
        paymentVerified: false,
        verificationIssue: 'amount_mismatch'
      }
    } else {
      update = {
        status: 'paid',
        paymentVerified: true,
        transactionId: field(response, 'transactionId', 'transaction_id') || '',
        paidAt: cloud.database().serverDate()
      }
    }
  } else if (tradeState === 'CLOSED' || tradeState === 'REVOKED' || tradeState === 'PAYERROR') {
    update = { status: 'closed', paymentVerified: false }
  } else if (tradeState === 'REFUND') {
    update = { status: 'refunded', paymentVerified: true }
  }

  if (!update) return order
  update.updatedAt = cloud.database().serverDate()
  await cloud.database().collection(ORDER_COLLECTION).doc(order.orderId).update({ data: update })
  // Re-read so the response contains resolved database dates rather than
  // serverDate command placeholders.
  return getOrder(order.orderId)
}

function errorResult(error) {
  const appError = error instanceof AppError
    ? error
    : new AppError('QUERY_ORDER_FAILED', '查询订单失败，请稍后重试')
  if (!(error instanceof AppError)) {
    console.error('queryOrder failed', { name: error && error.name })
  }
  return {
    ok: false,
    error: { code: appError.code, message: appError.message },
    message: appError.message
  }
}

exports.main = async (event = {}) => {
  try {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new AppError('INVALID_INPUT', '请求参数必须是对象')
    }
    const wxContext = cloud.getWXContext()
    if (!wxContext || !wxContext.OPENID) {
      throw new AppError('AUTH_REQUIRED', '请从已登录的小程序查询订单')
    }

    const orderId = cleanOrderId(event.orderId)
    let order = await getOrder(orderId)
    if (!order || order.openId !== wxContext.OPENID) {
      // Do not reveal whether an order belonging to another user exists.
      throw new AppError('ORDER_NOT_FOUND', '订单不存在')
    }

    const refresh = event.refresh === true
    let refreshed = false
    if (refresh && order.paymentMode === 'wechat' && !FINAL_STATUSES.has(order.status)) {
      order = await refreshWechatOrder(order)
      refreshed = true
    }

    return {
      ok: true,
      ...publicOrder(order),
      refreshed,
      message: order.paymentMode === 'mock'
        ? '这是模拟订单状态，不代表真实支付或扣款'
        : undefined
    }
  } catch (error) {
    return errorResult(error)
  }
}
