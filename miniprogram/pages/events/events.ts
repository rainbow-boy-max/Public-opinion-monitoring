import { timeAgo, getPlatformLabel, getSentimentLabel } from '../../utils/util'

Page({
  data: {
    searchKeyword: '',
    currentFilter: '',
    events: [] as any[],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
  },

  getPlatformLabel,
  getSentimentLabel,
  timeAgo,

  onShow() {
    if (this.data.events.length === 0) {
      this.fetchEvents(true)
    }
  },

  onSearchInput(e: any) {
    this.setData({ searchKeyword: e.detail.value })
  },

  onSearch() {
    this.setData({ page: 1, events: [], hasMore: true })
    this.fetchEvents(true)
  },

  onFilter(e: any) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.currentFilter) return
    this.setData({ currentFilter: filter, page: 1, events: [], hasMore: true })
    this.fetchEvents(true)
  },

  async fetchEvents(reset = false) {
    const token = wx.getStorageSync('token')
    if (!token || this.data.loading) return

    this.setData({ loading: true })

    try {
      const { page, pageSize, searchKeyword, currentFilter } = this.data
      const params: any = { page, pageSize }
      if (searchKeyword.trim()) params.keyword = searchKeyword.trim()
      if (currentFilter) params.sentiment = currentFilter

      const queryStr = Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&')

      const res: any = await new Promise((resolve, reject) => {
        wx.request({
          url: `https://api.example.com/api/monitor-tasks/events?${queryStr}`,
          method: 'GET',
          header: { 'Authorization': `Bearer ${token}` },
          success: (r: any) => {
            if (r.statusCode === 200) resolve(r.data)
            else if (r.statusCode === 401) {
              wx.removeStorageSync('token')
              wx.redirectTo({ url: '/pages/login/login' })
            } else reject(r.data)
          },
          fail: reject,
        })
      })

      const items = res.items || res.data || res || []
      const total = res.total || items.length

      this.setData({
        events: [...this.data.events, ...items],
        hasMore: this.data.events.length + items.length < total,
      })
    } catch (err) {
      console.error('Fetch events failed:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1 })
    this.fetchEvents()
  },

  onEventTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}` })
  },
})
