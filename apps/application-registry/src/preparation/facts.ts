import { factsR2ObjectStoreLayer, factsReaderLayer } from '@cv/facts-r2'
import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { Effect, Layer } from 'effect'

import { factsR2Options } from './config'

/** Lazily acquires the signed private-R2 reader at the browser runtime boundary. */
export const factsReaderBrowserLayer = Layer.unwrap(
  Effect.sync(() =>
    factsReaderLayer.pipe(
      Layer.provide(
        Layer.merge(
          factsR2ObjectStoreLayer(factsR2Options()),
          BrowserCrypto.layer
        )
      )
    )
  )
)
