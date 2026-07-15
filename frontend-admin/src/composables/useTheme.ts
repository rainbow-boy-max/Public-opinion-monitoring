import { ref } from 'vue'

const isDark = ref(localStorage.getItem('theme') !== 'light')

export function useTheme() {
  function applyTheme(dark: boolean) {
    isDark.value = dark
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.classList.toggle('light', !dark)
  }

  function toggleTheme() {
    applyTheme(!isDark.value)
  }

  applyTheme(isDark.value)

  return { isDark, toggleTheme, applyTheme }
}
