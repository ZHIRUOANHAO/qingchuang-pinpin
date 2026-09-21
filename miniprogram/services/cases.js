const { caseSummaries } = require('../data/case-summaries')

function list({ keyword = '', tag = '全部', access = 'all', page = 1, pageSize = 6 } = {}) {
  const normalized = keyword.trim().toLowerCase()
  const filtered = caseSummaries.filter(item => {
    const matchesKeyword = !normalized || `${item.title} ${item.industry} ${item.value} ${item.tags.join(' ')}`.toLowerCase().includes(normalized)
    const matchesTag = tag === '全部' || item.tags.includes(tag)
    return matchesKeyword && matchesTag && (access === 'all' || item.access === access)
  })
  const start = (page - 1) * pageSize
  return Promise.resolve({ list: filtered.slice(start, start + pageSize), total: filtered.length })
}

function detail(id) {
  const { findCase } = require('../data/cases')
  return Promise.resolve(findCase(id))
}

function availableTags() {
  return ['全部', ...new Set(caseSummaries.flatMap(item => item.tags))]
}

module.exports = { list, detail, availableTags }
