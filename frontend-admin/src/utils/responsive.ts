import { ref, computed, onMounted, onUnmounted } from 'vue'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

const breakpoint = ref<Breakpoint>('desktop')

function getBreakpoint(w: number): Breakpoint {
  if (w <= 767) return 'mobile'
  if (w <= 1023) return 'tablet'
  return 'desktop'
}

export function useBreakpoint() {
  let resizeTimer: number | undefined

  const onResize = () => {
    if (resizeTimer) window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      breakpoint.value = getBreakpoint(window.innerWidth)
    }, 100)
  }

  onMounted(() => {
    breakpoint.value = getBreakpoint(window.innerWidth)
    window.addEventListener('resize', onResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
    if (resizeTimer) window.clearTimeout(resizeTimer)
  })

  return {
    breakpoint,
    isMobile: computed(() => breakpoint.value === 'mobile'),
    isTablet: computed(() => breakpoint.value === 'tablet'),
    isDesktop: computed(() => breakpoint.value === 'desktop'),
  }
}

/**
 * 返回响应式 dialog 宽度百分比
 */
export function useDialogWidth() {
  const w = computed(() => {
    const bw = breakpoint.value
    if (bw === 'mobile') return '95%'
    if (bw === 'tablet') return '85%'
    return '60%'
  })
  return w
}
