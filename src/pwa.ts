import { registerSW } from 'virtual:pwa-register';

export const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New application version detected. Auto-updating service worker.');
  },
  onOfflineReady() {
    console.log('[PWA] App shell and assets are now cached for offline use.');
  },
  onRegistered(registration) {
    console.log('[PWA] Service Worker registered successfully.', registration);
    if (registration) {
      // Check for updates periodically when online
      setInterval(() => {
        if (navigator.onLine) {
          registration.update().catch((err) => {
            console.warn('[PWA] Periodic update check notice:', err);
          });
        }
      }, 30 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.warn('[PWA] Service Worker registration notice:', error);
  },
});
