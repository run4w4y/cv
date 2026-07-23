import { beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

import {
  invalidateWebRegistryConnection,
  WEB_REGISTRY_CONNECTION_SCHEMA_VERSION,
  WEB_REGISTRY_CONNECTION_STORAGE_KEY,
} from '../src/host/web-registry-connection'

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

beforeEach(() => {
  window.localStorage.setItem(
    WEB_REGISTRY_CONNECTION_STORAGE_KEY,
    JSON.stringify({
      origin: 'http://localhost',
      schemaVersion: WEB_REGISTRY_CONNECTION_SCHEMA_VERSION,
      token: 'test-registry-token',
    })
  )
  invalidateWebRegistryConnection()
})
