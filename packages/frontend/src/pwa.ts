import { registerSW } from 'virtual:pwa-register'

// autoUpdate: check for updates and apply immediately, reload handled by Workbox.
export function initPwa() {
  if (!('serviceWorker' in navigator)) return
  registerSW({ immediate: true })
}
