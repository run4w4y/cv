import { makeChatGptSubscriptionAiProviderLayer } from '@cv/ai-provider/live'
import { WebCryptoLayer } from '@cv/effect-web-crypto'
import { Layer } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { registryClientLayer } from '../../lib/registry-client'
import { preparationRepositoryLayer } from './repository'

const preparationBrowserAdapters = Layer.mergeAll(
  registryClientLayer,
  makeChatGptSubscriptionAiProviderLayer({ basePath: '/api/chatgpt' }),
  WebCryptoLayer
)

export const preparationDataLayer = preparationRepositoryLayer.pipe(
  Layer.provide(preparationBrowserAdapters)
)

/** Browser-safe Effect services shared by preparation query and command atoms. */
export const preparationDataRuntime = Atom.runtime(preparationDataLayer)
