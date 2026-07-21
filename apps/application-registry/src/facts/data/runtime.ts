import { factsHttpObjectStoreLayer } from '@cv/facts-reader/http'
import { factsReaderLayer } from '@cv/facts-reader/reader'
import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { Layer } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { hostHttpClientLayer } from '@/lib/registry-client'

/** Acquires verified facts through the authenticated same-origin Worker proxy. */
export const factsReaderBrowserLayer = factsReaderLayer.pipe(
  Layer.provide(
    Layer.merge(
      factsHttpObjectStoreLayer().pipe(Layer.provide(hostHttpClientLayer)),
      BrowserCrypto.layer
    )
  )
)

/** Browser-safe facts services shared by the facts page and preparation flows. */
export const factsDataRuntime = Atom.runtime(factsReaderBrowserLayer)
