Page({
  data: {
    username: '',
    password: '',
    loading: false,
    errorMsg: '',
  },

  onUsernameInput(e: any) {
    this.setData({ username: e.detail.value })
  },

  onPasswordInput(e: any) {
    this.setData({ password: e.detail.value })
  },

  async onLogin() {
    const { username, password } = this.data
    if (!username.trim()) {
      wx.showToast({ title: '请输入用户名', icon: 'none' })
      return
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }

    this.setData({ loading: true, errorMsg: '' })

    try {
      const res: any = await new Promise((resolve, reject) => {
        wx.request({
          url: 'https://api.example.com/api/auth/login',
          method: 'POST',
          data: { username: username.trim(), password },
          header: { 'Content-Type': 'application/json' },
          success: (r: any) => {
            if (r.statusCode === 200) resolve(r.data)
            else reject(r.data)
          },
          fail: reject,
        })
      })

      wx.setStorageSync('token', res.token)
      wx.setStorageSync('user_info', res.user)

      wx.switchTab({ url: '/pages/index/index' })
    } catch (err: any) {
      const msg = err?.message || err?.messageZh || '登录失败，请重试'
      wx.showToast({ title: msg, icon: 'none' })
      this.setData({ errorMsg: msg })
    } finally {
      this.setData({ loading: false })
    }
  },

  onRegister() {
    wx.showToast({ title: '注册功能开发中', icon: 'none' })
  },

  onForgotPassword() {
    wx.showToast({ title: '请联系管理员重置密码', icon: 'none' })
  },
})
