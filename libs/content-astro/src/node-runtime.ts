import {
  type WebCryptoApi,
  WebCryptoApiLayer,
} from '@cv/private-content-crypto'
import { NodeServices } from '@effect/platform-node'
import { Effect, Layer } from 'effect'

type ContentAstroRuntime = NodeServices.NodeServices | WebCryptoApi

const ContentAstroRuntimeLayer = Layer.merge(
  NodeServices.layer,
  WebCryptoApiLayer
)

export const runEffectPromise = <A, E>(
  effect: Effect.Effect<A, E, ContentAstroRuntime>
) => Effect.runPromise(effect.pipe(Effect.provide(ContentAstroRuntimeLayer)))
