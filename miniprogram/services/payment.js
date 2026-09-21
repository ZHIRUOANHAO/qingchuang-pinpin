const { env } = require('../config/env')

async function createOrder(product) {
  if (env.mockMode || !wx.cloud) {
    return { orderId: `MOCK-${Date.now()}`, status: 'mock_paid', amount: product.amount, mock: true, paymentVerified: false }
  }
  const { result } = await wx.cloud.callFunction({ name: 'createOrder', data: { productId: product.id } })
  if (!result || result.ok === false) throw new Error(result && result.message ? result.message : '订单创建失败')
  return result
}

async function queryOrder(orderId) {
  const { result } = await wx.cloud.callFunction({ name: 'queryOrder', data: { orderId, refresh: true } })
  if (!result || result.ok === false) throw new Error(result && result.message ? result.message : '订单查询失败')
  return result
}

async function pay(product) {
  const order = await createOrder(product)
  if (order.mock) {
    return new Promise(resolve => setTimeout(() => resolve(order), 500))
  }
  await wx.requestPayment(order.payment)
  const verified = await queryOrder(order.orderId)
  if (verified.status !== 'paid' || verified.paymentVerified !== true) {
    return { ...verified, status: verified.status || 'pending_payment', message: '客户端支付流程已结束，服务端仍在确认结果' }
  }
  return verified
}

module.exports = { createOrder, queryOrder, pay }
