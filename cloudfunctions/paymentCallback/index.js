const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const ORDER_COLLECTION = 'orders'

class AppError extends Error {
  constructor(code, message, retryable = false) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.retryable = retryable
  }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function cleanOrderId(value) {
  const orderId = firstString(value)
  if (!orderId || orderId.length > 32 || !/^[A-Za-z0-9_-]+$/.test(orderId)) {
    throw new AppError('INVALID_CALLBACK', '回调缺少有效订单号')
  }
  return orderId
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new AppError('PAYMENT_CONFIG_MISSING', `缺少服务端环境变量 ${name}`, true)
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

async function getOrder(orderId) {
  try {
    const result = await cloud.database().collection(ORDER_COLLECTION).doc(orderId).get()
    return result.data
  } catch (error) {
    const message = String((error && (error.errMsg || error.message)) || '')
    if (/not exist|not found|DATABASE_REQUEST_FAILED/i.test(message)) {
      throw new AppError('ORDER_NOT_FOUND', '回调对应的订单不存在')
    }
    throw new AppError('ORDER_STORAGE_UNAVAILABLE', '订单存储暂时不可用', true)
  }
}

async function updateOrder(orderId, data) {
  try {
    await cloud.database().collection(ORDER_COLLECTION).doc(orderId).update({
      data: { ...data, updatedAt: cloud.database().serverDate() }
    })
  } catch (error) {
    console.error('callback order update failed', { name: error && error.name })
    throw new AppError('ORDER_UPDATE_FAILED', '订单状态更新失败', true)
  }
}

async function queryWechatPayment(order) {
  const subMchId = requireEnv('WECHAT_SUB_MCH_ID')
  try {
    return await cloud.cloudPay.queryOrder({
      sub_mch_id: subMchId,
      out_trade_no: order.outTradeNo,
      nonce_str: crypto.randomBytes(16).toString('hex')
    })
  } catch (error) {
    console.error('callback payment verification failed', { name: error && error.name })
    throw new AppError('WECHAT_ORDER_QUERY_FAILED', '无法向微信支付复核订单', true)
  }
}

async function handleMock(event, order) {
  if ((process.env.PAYMENT_MODE || 'mock').trim().toLowerCase() !== 'mock') {
    throw new AppError('MOCK_DISABLED', '当前环境未启用模拟支付')
  }
  if (event.mockAction !== 'complete') {
    throw new AppError('INVALID_MOCK_ACTION', '模拟回调仅支持 mockAction=complete')
  }

  const wxContext = cloud.getWXContext()
  if (!wxContext || !wxContext.OPENID || wxContext.OPENID !== order.openId) {
    throw new AppError('AUTH_REQUIRED', '只能由订单所属用户完成模拟回调')
  }

  await updateOrder(order.orderId, {
    status: 'mock_paid',
    paymentVerified: false,
    mockCompletedAt: cloud.database().serverDate()
  })
  return {
    errcode: 0,
    ok: true,
    orderId: order.orderId,
    status: 'mock_paid',
    mock: true,
    paymentVerified: false,
    message: '模拟流程已完成；未发生真实扣款，不代表真实支付成功'
  }
}

async function handleWechat(order) {
  const response = await queryWechatPayment(order)
  if (field(response, 'returnCode', 'return_code') !== 'SUCCESS') {
    throw new AppError('WECHAT_ORDER_QUERY_FAILED', '微信支付复核未成功', true)
  }

  const tradeState = field(response, 'tradeState', 'trade_state')
  if (tradeState !== 'SUCCESS') {
    // A callback can race with WeChat's query endpoint; ask WeChat to retry it.
    throw new AppError('PAYMENT_NOT_CONFIRMED', `微信支付状态尚未确认：${tradeState || 'UNKNOWN'}`, true)
  }

  const actualAmount = toInteger(field(response, 'totalFee', 'total_fee'))
  if (actualAmount !== order.amount) {
    await updateOrder(order.orderId, {
      status: 'payment_review',
      paymentVerified: false,
      verificationIssue: 'amount_mismatch'
    })
    throw new AppError('PAYMENT_AMOUNT_MISMATCH', '支付金额与订单金额不一致')
  }

  const transactionId = firstString(
    field(response, 'transactionId', 'transaction_id'),
    order.transactionId
  )
  await updateOrder(order.orderId, {
    status: 'paid',
    paymentVerified: true,
    transactionId,
    paidAt: order.paidAt || cloud.database().serverDate()
  })
  return {
    errcode: 0,
    ok: true,
    orderId: order.orderId,
    status: 'paid',
    mock: false,
    paymentVerified: true
  }
}

function callbackFailure(error) {
  const appError = error instanceof AppError
    ? error
    : new AppError('PAYMENT_CALLBACK_FAILED', '支付回调处理失败', true)
  if (!(error instanceof AppError)) {
    console.error('paymentCallback failed', { name: error && error.name })
  } else {
    console.error('paymentCallback rejected', { code: appError.code })
  }
  return {
    errcode: appError.retryable ? 1 : 2,
    ok: false,
    error: { code: appError.code, message: appError.message },
    message: appError.message
  }
}

exports.main = async (event = {}) => {
  try {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new AppError('INVALID_CALLBACK', '回调参数必须是对象')
    }
    const orderId = cleanOrderId(
      event.orderId || event.outTradeNo || event.out_trade_no
    )
    const order = await getOrder(orderId)

    if (order.paymentMode === 'mock') return await handleMock(event, order)
    if (order.paymentMode !== 'wechat') {
      throw new AppError('PAYMENT_MODE_INVALID', '订单支付模式无效')
    }
    return await handleWechat(order)
  } catch (error) {
    return callbackFailure(error)
  }
}
