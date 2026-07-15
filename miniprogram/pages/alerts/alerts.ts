import { formatDateTime } from '../../utils/util'

const CONDITION_LABELS: Record<string, string> = {
  keyword_match: '关键词匹配',
  sentiment_change: '情感变化',
  volume_spike: '数量突增',
  competitor_mention: '竞品提及',
  propagation_warning: '传播预警',
}

const CHANNEL_LABELS: Record<string, string> = {
  app: '应用内',
  sms: '短信',
  email: '邮件',
  webhook: 'Webhook',
}

Page({
  data: {
    rules: [] as any[],
    alertLogs: [] as any[],
    alertLogCount: 0,
    activeCount: 0,
  },

  getConditionLabel(type: string) {
    return CONDITION_LABELS[type] || type
  },

  getChannelLabel(channel: string) {
    return CHANNEL_LABELS[channel] || channel
  },

  formatDateTime,

  onShow() {
    this.fetchRules()
    this.fetchAlertLogs()
  },

  async fetchRules() {
    const token = wx.getStorageSync('token')
    if (!token) return

    try {
      const res: any = await new Promise((resolve, reject) => {
        wx.request({
          url: 'https://api.example.com/api/alert/rules',
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

      const rules = Array.isArray(res) ? res : res.items || res.data || []
      this.setData({
        rules,
        activeCount: rules.filter((r: any) => r.status === 'enabled').length,
      })
    } catch (err) {
      console.error('Fetch rules failed:', err)
    }
  },

  async fetchAlertLogs() {
    const token = wx.getStorageSync('token')
    if (!token) return

    try {
      const res: any = await new Promise((resolve, reject) => {
        wx.request({
          url: 'https://api.example.com/api/alert/logs?page=1&limit=10',
          method: 'GET',
          header: { 'Authorization': `Bearer ${token}` },
          success: (r: any) => {
            if (r.statusCode === 200) resolve(r.data)
            else reject(r.data)
          },
          fail: reject,
        })
      })

      const logs = res.items || res.data || []
      this.setData({
        alertLogs: logs,
        alertLogCount: res.total || logs.length,
      })
    } catch (err) {
      console.error('Fetch alert logs failed:', err)
    }
  },

  async onToggleRule(e: any) {
    const id = e.currentTarget.dataset.id
    const token = wx.getStorageSync('token')
    if (!token) return

    try {
      await new Promise((resolve, reject) => {
        wx.request({
          url: `https://api.example.com/api/alert/rules/${id}/toggle`,
          method: 'POST',
          header: { 'Authorization': `Bearer ${token}` },
          success: (r: any) => {
            if (r.statusCode === 200) resolve(r.data)
            else reject(r.data)
          },
          fail: reject,
        })
      })
      this.fetchRules()
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  onAddRule() {
    wx.showToast({ title: '添加预警规则功能开发中', icon: 'none' })
  },
})
