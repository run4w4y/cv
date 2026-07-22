import { GlobalRegistrator } from '@happy-dom/global-registrator'

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
