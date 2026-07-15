import { formatDateTime, formatCount, getPlatformLabel, getSentimentLabel } from '../../utils/util'

Page({
  data: {
    event: {} as any,
    eventId: 0,
  },

  getPlatformLabel,
  getSentimentLabel,
  formatDateTime,
  formatCount,

  onLoad(options: any) {
    const id = parseInt(options.id || '0', 10)
    if (id) {
      this.setData({ eventId: id })
      this.fetchEventDetail(id)
    }
  },

  async fetchEventDetail(id: number) {
    const token = wx.getStorageSync('token')
    if (!token) return

    try {
      const res: any = await new Promise((resolve, reject) => {
        wx.request({
          url: `https://api.example.com/api/events/${id}`,
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

      this.setData({ event: res })
    } catch (err) {
      wx.showToast({ title: '获取事件详情失败', icon: 'none' })
    }
  },

  onOpenSource() {
    const url = this.data.event.url
    if (url) {
      wx.setClipboardData({
        data: url,
        success: () => {
          wx.showToast({ title: '链接已复制', icon: 'success' })
        },
      })
    }
  },
})
