import CONFIG from './config'

export function getToken(): string {
  return wx.getStorageSync(CONFIG.TOKEN_KEY) || ''
}

export function setToken(token: string) {
  wx.setStorageSync(CONFIG.TOKEN_KEY, token)
}

export function removeToken() {
  wx.removeStorageSync(CONFIG.TOKEN_KEY)
}

export function getUserInfo(): any {
  return wx.getStorageSync(CONFIG.USER_KEY) || null
}

export function setUserInfo(user: any) {
  wx.setStorageSync(CONFIG.USER_KEY, user)
}

export function removeUserInfo() {
  wx.removeStorageSync(CONFIG.USER_KEY)
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

export function logout() {
  removeToken()
  removeUserInfo()
  wx.redirectTo({ url: '/pages/login/login' })
}
