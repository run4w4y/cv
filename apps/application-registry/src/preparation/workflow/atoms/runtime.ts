import { makeChatGptSubscriptionAiProviderLayer } from '@cv/ai-provider/live'
import {
  ApplicationPreparation,
  applicationPreparationLayer,
} from '@cv/application-preparation-workflow'
import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { Effect, Layer } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import { registryClientLayer } from '@/lib/registry-client'
import { preparationRepositoryLayer } from '@/preparation/data/repository'
import { factsReaderBrowserLayer } from '@/preparation/facts'
import { preparationStoreLayer } from '../store'

const browserAdaptersLayer = Layer.mergeAll(
  registryClientLayer,
  makeChatGptSubscriptionAiProviderLayer({ basePath: '/api/chatgpt' }),
  factsReaderBrowserLayer,
  BrowserCrypto.layer
)

const repositoryLayer = preparationRepositoryLayer.pipe(
  Layer.provide(browserAdaptersLayer)
)

const storeLayer = preparationStoreLayer.pipe(Layer.provide(repositoryLayer))

const workflowDependenciesLayer = Layer.mergeAll(
  storeLayer,
  browserAdaptersLayer,
  WorkflowEngine.layerMemory
)

export const preparationRuntimeLayer = applicationPreparationLayer().pipe(
  Layer.provide(workflowDependenciesLayer)
)

export const preparationRuntime = Atom.runtime(preparationRuntimeLayer).pipe(
  Atom.keepAlive
)

export const preparationRunsAtom = preparationRuntime
  .subscriptionRef(Effect.map(ApplicationPreparation, ({ runs }) => runs))
  .pipe(Atom.keepAlive)
