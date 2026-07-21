import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { Layer } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { factsReaderBrowserLayer } from '@/facts/data/runtime'
import { hostStructuredGenerationLayer } from '@/host/structured-generation'
import { registryClientLayer } from '@/lib/registry-client'
import { preparationRepositoryLayer } from './repository'

const preparationBrowserAdapters = Layer.mergeAll(
  registryClientLayer,
  hostStructuredGenerationLayer(),
  factsReaderBrowserLayer,
  BrowserCrypto.layer
)

export const preparationDataLayer = preparationRepositoryLayer.pipe(
  Layer.provide(preparationBrowserAdapters)
)

/** Browser-safe Effect services shared by preparation query and command atoms. */
export const preparationDataRuntime = Atom.runtime(preparationDataLayer)
