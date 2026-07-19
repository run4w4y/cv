import { GlobalRegistrator } from '@happy-dom/global-registrator'

process.env.VITE_FACTS_R2_ACCOUNT_ID ??= '00000000000000000000000000000000'
process.env.VITE_FACTS_R2_BUCKET ??= 'application-registry-test-facts'
process.env.VITE_FACTS_R2_ACCESS_KEY_ID ??= 'test-access-key'
process.env.VITE_FACTS_R2_SECRET_ACCESS_KEY ??= 'test-secret-key'

if (!GlobalRegistrator.isRegistered) {
  GlobalRegistrator.register({
    settings: {
      navigation: {
        disableChildFrameNavigation: true,
        disableFallbackToSetURL: true,
      },
    },
    url: 'http://localhost',
  })
}

Object.defineProperty(window, 'getSelection', {
  configurable: true,
  value: () => ({ anchorNode: null, collapse: () => undefined }),
})

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
