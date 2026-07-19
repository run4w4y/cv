import { makeChatGptSubscriptionAiProviderLayer } from '@cv/ai-provider/live'
import { WebCryptoLayer } from '@cv/effect-web-crypto'
import { Effect, Layer } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import { registryClientLayer } from '../../../lib/registry-client'
import { preparationGatewayLayer } from '../gateway'
import { PreparationProgress, preparationProgressLayer } from '../progress'
import {
  preparationConcurrencyLayer,
  preparationWorkflowLayer,
} from '../workflow'

const browserAdaptersLayer = Layer.merge(
  Layer.merge(
    registryClientLayer,
    makeChatGptSubscriptionAiProviderLayer({ basePath: '/api/chatgpt' })
  ),
  WebCryptoLayer
)

const gatewayLayer = preparationGatewayLayer.pipe(
  Layer.provide(browserAdaptersLayer)
)

const workflowServicesLayer = Layer.mergeAll(
  gatewayLayer,
  preparationProgressLayer,
  preparationConcurrencyLayer,
  WebCryptoLayer
)

export const preparationRuntimeLayer = preparationWorkflowLayer.pipe(
  Layer.provideMerge(workflowServicesLayer),
  Layer.provideMerge(WorkflowEngine.layerMemory)
)

export const preparationRuntime = Atom.runtime(preparationRuntimeLayer).pipe(
  Atom.keepAlive
)

export const preparationRunsAtom = preparationRuntime
  .subscriptionRef(Effect.map(PreparationProgress, ({ runs }) => runs))
  .pipe(Atom.keepAlive)
