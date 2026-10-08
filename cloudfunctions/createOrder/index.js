const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const ORDER_COLLECTION = 'orders'
const PAYMENT_MODES = new Set(['mock', 'wechat'])
const DEFAULT_MOCK_CATALOG = {
  'demo-analysis': {
    name: '轻创拼拼分析服务演示订单',
    amount: 1
  }
}

class AppError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

function cleanString(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('INVALID_INPUT', `${field} 不能为空`)
  }
  const result = value.trim()
  if (result.length > maxLength) {
    throw new AppError('INVALID_INPUT', `${field} 超出长度限制`)
  }
  return result
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new AppError('PAYMENT_CONFIG_MISSING', `缺少服务端环境变量 ${name}`)
  }
  return value.trim()
}

function paymentMode() {
  const mode = (process.env.PAYMENT_MODE || 'mock').trim().toLowerCase()
  if (!PAYMENT_MODES.has(mode)) {
    throw new AppError('PAYMENT_CONFIG_INVALID', 'PAYMENT_MODE 仅支持 mock 或 wechat')
  }
  return mode
}

function parseCatalog(mode) {
  const raw = process.env.PRODUCT_CATALOG_JSON
  if (!raw || !raw.trim()) {
    if (mode === 'mock') return DEFAULT_MOCK_CATALOG
    throw new AppError(
      'PAYMENT_CONFIG_MISSING',
      '真实支付必须配置服务端环境变量 PRODUCT_CATALOG_JSON'
    )
  }

  let catalog
  try {
    catalog = JSON.parse(raw)
  } catch (error) {
    throw new AppError('PAYMENT_CONFIG_INVALID', 'PRODUCT_CATALOG_JSON 不是有效 JSON')
  }
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    throw new AppError('PAYMENT_CONFIG_INVALID', 'PRODUCT_CATALOG_JSON 必须是产品对象')
  }
  return catalog
}

function resolveProduct(productId, mode) {
  const product = parseCatalog(mode)[productId]
  if (!product || typeof product !== 'object' || Array.isArray(product)) {
    throw new AppError('PRODUCT_NOT_FOUND', '产品不存在或已下架')
  }

  const name = cleanString(product.name, '产品名称', 64)
  const amount = Number(product.amount)
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000) {
    throw new AppError('PAYMENT_CONFIG_INVALID', '产品金额必须是 1 至 100000000 的整数分')
  }
  return { id: productId, name, amount }
}

function createOrderId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `QCP${stamp}${crypto.randomBytes(6).toString('hex')}`
}

function publicError(error) {
  const appError = error instanceof AppError
    ? error
    : new AppError('CREATE_ORDER_FAILED', '创建订单失败，请稍后重试')
  if (!(error instanceof AppError)) {
    console.error('createOrder failed', { name: error && error.name })
  }
  return {
    ok: false,
    error: { code: appError.code, message: appError.message },
    message: appError.message
  }
}

async function updateOrder(orderId, data) {
  await cloud.database().collection(ORDER_COLLECTION).doc(orderId).update({ data })
}

exports.main = async (event = {}) => {
  let orderId = ''
  try {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new AppError('INVALID_INPUT', '请求参数必须是对象')
    }

    const wxContext = cloud.getWXContext()
    if (!wxContext || !wxContext.OPENID) {
      throw new AppError('AUTH_REQUIRED', '请从已登录的小程序创建订单')
    }

    const productId = cleanString(event.productId, 'productId', 64)
    if (!/^[A-Za-z0-9_-]+$/.test(productId)) {
      throw new AppError('INVALID_INPUT', 'productId 格式无效')
    }

    const mode = paymentMode()
    const product = resolveProduct(productId, mode)
    orderId = createOrderId()
    const now = cloud.database().serverDate()
    const initialStatus = mode === 'mock' ? 'pending_mock' : 'creating_payment'
    const order = {
      orderId,
      outTradeNo: orderId,
      openId: wxContext.OPENID,
      appId: wxContext.APPID || '',
      productId: product.id,
      productName: product.name,
      amount: product.amount,
      currency: 'CNY',
      status: initialStatus,
      paymentMode: mode,
      paymentVerified: false,
      createdAt: now,
      updatedAt: now
    }

    try {
      await cloud.database().collection(ORDER_COLLECTION).doc(orderId).set({ data: order })
    } catch (error) {
      console.error('order persistence failed', { name: error && error.name })
      throw new AppError(
        'ORDER_STORAGE_UNAVAILABLE',
        `订单保存失败，请确认云数据库已创建 ${ORDER_COLLECTION} 集合`
      )
    }

    if (mode === 'mock') {
      return {
        ok: true,
        orderId,
        status: 'pending_mock',
        amount: product.amount,
        currency: 'CNY',
        productId: product.id,
        productName: product.name,
        mock: true,
        paymentVerified: false,
        message: '这是模拟订单，未发生真实扣款，也不代表支付成功'
      }
    }

    const envId = requireEnv('CLOUD_ENV_ID')
    const subMchId = requireEnv('WECHAT_SUB_MCH_ID')
    const callbackFunction = (process.env.PAYMENT_CALLBACK_FUNCTION || 'paymentCallback').trim()
    const response = await cloud.cloudPay.unifiedOrder({
      body: product.name,
      outTradeNo: orderId,
      spbillCreateIp: '127.0.0.1',
      subMchId,
      subOpenid: wxContext.OPENID,
      totalFee: product.amount,
      envId,
      functionName: callbackFunction,
      nonceStr: crypto.randomBytes(16).toString('hex'),
      tradeType: 'JSAPI'
    })

    const returnCode = response && (response.returnCode || response.return_code)
    const resultCode = response && (response.resultCode || response.result_code)
    if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS' || !response.payment) {
      await updateOrder(orderId, {
        status: 'payment_init_failed',
        updatedAt: cloud.database().serverDate()
      })
      throw new AppError('WECHAT_PAYMENT_INIT_FAILED', '微信支付预下单失败，请稍后重试')
    }

    await updateOrder(orderId, {
      status: 'pending_payment',
      updatedAt: cloud.database().serverDate()
    })
    return {
      ok: true,
      orderId,
      status: 'pending_payment',
      amount: product.amount,
      currency: 'CNY',
      productId: product.id,
      productName: product.name,
      mock: false,
      paymentVerified: false,
      payment: response.payment,
      message: '已创建待支付订单；客户端调起支付后仍须查询服务端状态确认结果'
    }
  } catch (error) {
    if (orderId && !(error instanceof AppError && error.code === 'ORDER_STORAGE_UNAVAILABLE')) {
      try {
        await updateOrder(orderId, {
          status: 'payment_init_failed',
          updatedAt: cloud.database().serverDate()
        })
      } catch (updateError) {
        console.error('failed to record createOrder error', { name: updateError && updateError.name })
      }
    }
    return publicError(error)
  }
}
