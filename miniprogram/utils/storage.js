function read(key, fallback = null) {
  const value = wx.getStorageSync(key)
  return value === '' || value === undefined ? fallback : value
}

function write(key, value) {
  wx.setStorageSync(key, value)
  return value
}

function appendUnique(key, item, idKey = 'id') {
  const list = read(key, [])
  const next = [item, ...list.filter(entry => entry[idKey] !== item[idKey])]
  write(key, next)
  return next
}

function removeById(key, id, idKey = 'id') {
  const next = read(key, []).filter(item => item[idKey] !== id)
  write(key, next)
  return next
}

module.exports = { read, write, appendUnique, removeById }

