import CONFIG from './config'

function request<T>(method: string, url: string, data?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync(CONFIG.TOKEN_KEY)
    wx.request({
      url: CONFIG.BASE_URL + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      success: (res: any) => {
        if (res.statusCode === 401) {
          wx.removeStorageSync(CONFIG.TOKEN_KEY)
          wx.removeStorageSync(CONFIG.USER_KEY)
          wx.redirectTo({ url: '/pages/login/login' })
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          const errMsg = res.data?.message || res.data?.messageZh || '请求失败'
          wx.showToast({ title: errMsg, icon: 'none' })
          reject({ statusCode: res.statusCode, message: errMsg })
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络请求失败，请检查网络', icon: 'none' })
        reject(err)
      },
    })
  })
}

export const api = {
  get: <T>(url: string, data?: any) => {
    return new Promise<T>((resolve, reject) => {
      const token = wx.getStorageSync(CONFIG.TOKEN_KEY)
      wx.request({
        url: CONFIG.BASE_URL + url,
        method: 'GET',
        data,
        header: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        success: (res: any) => {
          if (res.statusCode === 401) {
            wx.removeStorageSync(CONFIG.TOKEN_KEY)
            wx.removeStorageSync(CONFIG.USER_KEY)
            wx.redirectTo({ url: '/pages/login/login' })
            return
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            const errMsg = res.data?.message || res.data?.messageZh || '请求失败'
            wx.showToast({ title: errMsg, icon: 'none' })
            reject({ statusCode: res.statusCode, message: errMsg })
          }
        },
        fail: (err) => {
          wx.showToast({ title: '网络请求失败，请检查网络', icon: 'none' })
          reject(err)
        },
      })
    })
  },
  post: <T>(url: string, data?: any) => request<T>('POST', url, data),
  put: <T>(url: string, data?: any) => request<T>('PUT', url, data),
  delete: <T>(url: string) => request<T>('DELETE', url),
}
