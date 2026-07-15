import { timeAgo, getPlatformLabel, getSentimentLabel, formatDate, formatTime } from '../../utils/util'

Page({
  data: {
    username: '用户',
    greeting: '你好',
    currentDate: '',
    currentTime: '',
    timer: null as any,
    stats: [
      { label: '今日舆情', value: '0', type: 'total', color: '#5E72E4', bg: 'rgba(94, 114, 228, 0.12)', icon: '📊' },
      { label: '负面信息', value: '0', type: 'negative', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)', icon: '⚠️' },
      { label: '正面信息', value: '0', type: 'positive', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', icon: '👍' },
      { label: '触发预警', value: '0', type: 'alert', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', icon: '🔔' },
    ],
    recentEvents: [] as any[],
  },

  getPlatformLabel,
  getSentimentLabel,
  timeAgo,

  onLoad() {
    const userInfo = wx.getStorageSync('user_info')
    if (userInfo) {
      this.setData({
        username: userInfo.username || userInfo.phone || '用户',
      })
    }
    this.updateGreeting()
    this.updateTime()
    this.fetchDashboardData()
  },

  onShow() {
    this.startClock()
    this.fetchDashboardData()
  },

  onHide() {
    this.stopClock()
  },

  onUnload() {
    this.stopClock()
  },

  startClock() {
    this.stopClock()
    const timer = setInterval(() => {
      this.updateTime()
    }, 1000)
    this.setData({ timer })
  },

  stopClock() {
    if (this.data.timer) {
      clearInterval(this.data.timer)
      this.setData({ timer: null })
    }
  },

  updateTime() {
    const now = new Date()
    this.setData({
      currentDate: formatDate(now),
      currentTime: formatTime(now),
    })
  },

  updateGreeting() {
    const hour = new Date().getHours()
    let greeting = '你好'
    if (hour < 6) greeting = '夜深了'
    else if (hour < 9) greeting = '早上好'
    else if (hour < 12) greeting = '上午好'
    else if (hour < 14) greeting = '中午好'
    else if (hour < 18) greeting = '下午好'
    else greeting = '晚上好'
    this.setData({ greeting })
  },

  async fetchDashboardData() {
    const token = wx.getStorageSync('token')
    if (!token) return

    try {
      const res: any = await new Promise((resolve, reject) => {
        wx.request({
          url: 'https://api.example.com/api/dashboard/stats',
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`,
          },
          success: (r: any) => {
            if (r.statusCode === 200) resolve(r.data)
            else if (r.statusCode === 401) {
              wx.removeStorageSync('token')
              wx.redirectTo({ url: '/pages/login/login' })
              reject(r.data)
            } else reject(r.data)
          },
          fail: reject,
        })
      })

      this.setData({
        stats: [
          { label: '今日舆情', value: res.todayCount ?? res.todayTotal ?? 0, type: 'total', color: '#5E72E4', bg: 'rgba(94, 114, 228, 0.12)', icon: '📊' },
          { label: '负面信息', value: res.negativeCount ?? 0, type: 'negative', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)', icon: '⚠️' },
          { label: '正面信息', value: res.positiveCount ?? 0, type: 'positive', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', icon: '👍' },
          { label: '触发预警', value: res.alertCount ?? res.alertsTriggered ?? 0, type: 'alert', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', icon: '🔔' },
        ],
        recentEvents: res.recentEvents || res.recent || [],
      })
    } catch (err) {
      console.error('Dashboard fetch failed:', err)
    }
  },

  onStatTap(e: any) {
    const type = e.currentTarget.dataset.type
    if (type === 'total' || type === 'negative' || type === 'positive') {
      wx.switchTab({ url: '/pages/events/events' })
    } else if (type === 'alert') {
      wx.switchTab({ url: '/pages/alerts/alerts' })
    }
  },

  onEventTap(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}` })
  },

  onViewAllEvents() {
    wx.switchTab({ url: '/pages/events/events' })
  },

  onGoEvents() {
    wx.switchTab({ url: '/pages/events/events' })
  },

  onGoAlerts() {
    wx.switchTab({ url: '/pages/alerts/alerts' })
  },

  onGoProfile() {
    wx.switchTab({ url: '/pages/profile/profile' })
  },
})
