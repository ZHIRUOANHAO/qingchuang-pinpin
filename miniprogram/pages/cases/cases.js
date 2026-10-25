const caseService = require('../../services/cases')
const ads = require('../../config/ads')
const history = require('../../utils/case-history')
Page({
  data: { tags: caseService.availableTags(), tag: '全部', access: 'all', keyword: '', searchHistory: [], historyError: false, list: [], page: 1, pageSize: 10, total: 0, loading: true, loadingMore: false, refreshing: false, error: false, adSlot: ads.getSlot('casesFeed') },
  onLoad() { this.fetch(true) },
  onShow() {
    this.loadSearchHistory()
    try {
      const keyword = wx.getStorageSync('caseSearch')
      const access = wx.getStorageSync('caseAccess')
      if (keyword || access || this.data.access !== 'all') {
        wx.removeStorageSync('caseSearch'); wx.removeStorageSync('caseAccess')
        this.setData({ keyword: typeof keyword === 'string' ? keyword.slice(0, 80) : '', access: 'all', tag: access === 'starter' ? '轻量试做' : '全部' }, () => this.fetch(true))
      }
    } catch (error) {
      wx.showToast({ title: '筛选条件读取失败，可直接搜索', icon: 'none' })
    }
  },
  loadSearchHistory() {
    try { this.setData({ searchHistory: history.getSearchHistory(), historyError: false }) }
    catch (error) { this.setData({ searchHistory: [], historyError: true }) }
  },
  async fetch(reset = false) {
    if (!reset && this.pending) return
    clearTimeout(this.timer)
    const requestId = this.requestId = (this.requestId || 0) + 1
    this.pending = true
    if (reset) this.setData({ page: 1, loading: true, loadingMore: false, error: false })
    else this.setData({ loadingMore: true, error: false })
    try {
      const page = reset ? 1 : this.data.page
      const result = await caseService.list({ keyword: this.data.keyword, tag: this.data.tag, access: this.data.access, page, pageSize: this.data.pageSize })
      if (requestId !== this.requestId || this.disposed) return
      this.setData({ list: reset ? result.list : this.data.list.concat(result.list), total: result.total, loading: false, loadingMore: false, refreshing: false, page: page + 1 })
    } catch (error) { if (requestId === this.requestId && !this.disposed) this.setData({ loading: false, loadingMore: false, refreshing: false, error: true }) }
    finally { if (requestId === this.requestId) this.pending = false }
  },
  onSearch(event) { clearTimeout(this.timer); this.requestId = (this.requestId || 0) + 1; this.setData({ keyword: event.detail.value, loading: true }); this.timer = setTimeout(() => this.fetch(true), 250) },
  confirmSearch(event) {
    const value = event.detail && typeof event.detail.value === 'string' ? event.detail.value : this.data.keyword
    this.submitSearch(value)
  },
  submitSearch(value) {
    const keyword = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80)
    try { this.setData({ searchHistory: history.rememberSearch(keyword), historyError: false }) }
    catch (error) { this.setData({ historyError: true }); wx.showToast({ title: '搜索可用，历史保存失败', icon: 'none' }) }
    this.setData({ keyword }, () => this.fetch(true))
  },
  searchAgain(event) { this.submitSearch(event.currentTarget.dataset.keyword) },
  clearHistory() {
    wx.showModal({
      title: '清空最近搜索？', content: '只清空本机搜索词，不影响收藏、浏览记录或验证方案。', confirmText: '清空',
      success: result => {
        if (!result.confirm || this.disposed) return
        try { this.setData({ searchHistory: history.clearSearchHistory(), historyError: false }); wx.showToast({ title: '已清空搜索记录', icon: 'none' }) }
        catch (error) { wx.showToast({ title: '清空失败，请重试', icon: 'none' }) }
      }
    })
  },
  openHistory() { wx.navigateTo({ url: '/pages/history/history' }) },
  onUnload() { this.disposed = true; this.requestId = (this.requestId || 0) + 1; clearTimeout(this.timer) },
  clearSearch() { this.setData({ keyword: '' }, () => this.fetch(true)) },
  resetFilters() { this.setData({ keyword: '', tag: '全部', access: 'all' }, () => this.fetch(true)) },
  selectTag(event) { this.setData({ tag: event.currentTarget.dataset.tag }, () => this.fetch(true)) },
  refresh() { this.setData({ refreshing: true }, () => this.fetch(true)) },
  loadMore() { if (!this.data.loading && !this.pending && this.data.list.length < this.data.total) this.fetch(false) },
  openCase(event) { wx.navigateTo({ url: `/pages/case-detail/case-detail?id=${event.currentTarget.dataset.id}` }) }
})
