const { caseSummaries } = require('../data/case-summaries')

const searchIndex = caseSummaries.map(item => ({
  item,
  text: `${item.title} ${item.industry} ${item.value} ${item.tags.join(' ')}`.toLowerCase()
}))
const tags = ['全部', ...new Set(caseSummaries.flatMap(item => item.tags))]
let cachedQuery = null
let cachedResults = []

function list({ keyword = '', tag = '全部', access = 'all', page = 1, pageSize = 6 } = {}) {
  const normalized = keyword.trim().toLowerCase()
  const query = JSON.stringify([normalized, tag, access])
  if (query !== cachedQuery) {
    cachedResults = searchIndex.filter(({ item, text }) =>
      (!normalized || text.includes(normalized)) &&
      (tag === '全部' || item.tags.includes(tag)) &&
      (access === 'all' || item.access === access)
    ).map(({ item }) => item)
    cachedQuery = query
  }
  const start = (page - 1) * pageSize
  return { list: cachedResults.slice(start, start + pageSize), total: cachedResults.length }
}

function detail(id) {
  const { findCase } = require('../data/cases')
  return findCase(id)
}

function availableTags() {
  return tags.slice()
}

module.exports = { list, detail, availableTags }
