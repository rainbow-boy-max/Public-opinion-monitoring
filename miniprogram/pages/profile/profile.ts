import { logout } from '../../utils/auth'

Page({
  data: {
    userInfo: {} as any,
    avatarText: 'U',
    notificationEnabled: true,
    darkMode: true,
  },

  onShow() {
    const userInfo = wx.getStorageSync('user_info') || {}
    const name = userInfo.username || userInfo.phone || 'U'
    this.setData({
      userInfo,
      avatarText: name.charAt(0).toUpperCase(),
    })
  },

  onToggleNotification(e: any) {
    this.setData({ notificationEnabled: e.detail.value })
  },

  onChangePassword() {
    wx.showToast({ title: '修改密码功能开发中', icon: 'none' })
  },

  onAbout() {
    wx.showModal({
      title: '关于系统',
      content: '舆情监测系统 v1.0.0\n实时舆情监测、智能预警分析、多平台数据聚合。',
      showCancel: false,
    })
  },

  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          const token = wx.getStorageSync('token')
          if (token) {
            wx.request({
              url: 'https://api.example.com/api/auth/logout',
              method: 'POST',
              header: { 'Authorization': `Bearer ${token}` },
              fail: () => {},
            })
          }
          logout()
          wx.showToast({ title: '已退出登录', icon: 'success' })
        }
      },
    })
  },
})
