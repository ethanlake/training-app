// Theme is a property of the device, not of the training data, so it lives
// under its own key and stays out of the export blob.

export const THEME_KEY = 'training-app/theme'

// null means "follow the system"; the toggle only ever writes 'light' or 'dark'.
export function storedTheme() {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' ? v : null
}

export const systemPrefersDark = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

export function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark)
  // Keep the mobile browser chrome in step with the page.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isDark ? '#0a0a0a' : '#ffffff')
}
