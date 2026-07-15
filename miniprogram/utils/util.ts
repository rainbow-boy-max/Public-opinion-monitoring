export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return formatDate(d) + ' ' + formatTime(d)
}

export function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then

  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`

  return formatDateTime(dateStr)
}

export function formatCount(count: number): string {
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万'
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k'
  }
  return String(count)
}

export const PLATFORM_MAP: Record<string, { label: string; icon: string }> = {
  weixin: { label: '微信', icon: 'weixin' },
  weibo: { label: '微博', icon: 'weibo' },
  douyin: { label: '抖音', icon: 'douyin' },
  xiaohongshu: { label: '小红书', icon: 'xiaohongshu' },
  kuaishou: { label: '快手', icon: 'kuaishou' },
  baijiahao: { label: '百家号', icon: 'baijiahao' },
}

export function getPlatformLabel(platform: string): string {
  return PLATFORM_MAP[platform]?.label || platform
}

export const SENTIMENT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  positive: { label: '正面', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  negative: { label: '负面', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
  neutral: { label: '中性', color: '#9CA3AF', bg: 'rgba(107, 114, 128, 0.12)' },
}

export function getSentimentLabel(sentiment: string): string {
  return SENTIMENT_MAP[sentiment]?.label || sentiment
}
