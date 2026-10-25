const SEARCH_KEY = 'caseSearchHistory'
const RECENT_KEY = 'recentCases'
const SEARCH_LIMIT = 10
const RECENT_LIMIT = 20

function text(value, limit) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : ''
}

function readList(key) {
  const value = wx.getStorageSync(key)
  return Array.isArray(value) ? value : []
}

function getSearchHistory() {
  const seen = new Set()
  return readList(SEARCH_KEY).map(value => text(value, 80)).filter(keyword => {
    const identity = keyword.toLowerCase()
    if (!keyword || seen.has(identity)) return false
    seen.add(identity)
    return true
  }).slice(0, SEARCH_LIMIT)
}

function rememberSearch(keyword) {
  const value = text(keyword, 80)
  const previous = getSearchHistory()
  if (!value) return previous
  const next = [value, ...previous.filter(entry => entry.toLowerCase() !== value.toLowerCase())].slice(0, SEARCH_LIMIT)
  wx.setStorageSync(SEARCH_KEY, next)
  return next
}

function clearSearchHistory() {
  wx.removeStorageSync(SEARCH_KEY)
  return []
}

function recentRecord(item) {
  if (!item || typeof item !== 'object') return null
  const id = text(item.id, 80)
  const title = text(item.title, 200)
  if (!id || !title) return null
  const time = typeof item.time === 'number' && Number.isFinite(item.time) && item.time >= 0 ? item.time : 0
  return { id, title, industry: text(item.industry, 120), time }
}

function getRecentCases() {
  const seen = new Set()
  return readList(RECENT_KEY).map(recentRecord).filter(Boolean).sort((a, b) => b.time - a.time).filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  }).slice(0, RECENT_LIMIT)
}

function rememberCase(item) {
  const record = recentRecord(item)
  if (!record) throw new TypeError('无法记录缺少编号或标题的案例')
  record.time = Date.now()
  const next = [record, ...getRecentCases().filter(entry => entry.id !== record.id)].slice(0, RECENT_LIMIT)
  wx.setStorageSync(RECENT_KEY, next)
  return next
}

function removeRecentCase(id) {
  const next = getRecentCases().filter(item => item.id !== id)
  wx.setStorageSync(RECENT_KEY, next)
  return next
}

function clearRecentCases() {
  wx.removeStorageSync(RECENT_KEY)
  return []
}

module.exports = { rememberSearch, getSearchHistory, clearSearchHistory, rememberCase, getRecentCases, removeRecentCase, clearRecentCases }
