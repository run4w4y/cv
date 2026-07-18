import { Context, Effect } from 'effect'
import type { FactsReleasePublicationError } from './errors'
import { verifyFactsReleaseBundle } from './integrity'
import type {
  CompiledFactsRelease,
  FactsReleaseObject,
  FactsReleaseRegistration,
} from './model'
import { makeFactsReleaseRegistration } from './registration'

export type FactsReleasePublicationTargetShape = {
  readonly putObject: (
    object: FactsReleaseObject
  ) => Effect.Effect<void, FactsReleasePublicationError>
  readonly register: (
    registration: FactsReleaseRegistration
  ) => Effect.Effect<void, FactsReleasePublicationError>
}

export class FactsReleasePublicationTarget extends Context.Service<
  FactsReleasePublicationTarget,
  FactsReleasePublicationTargetShape
>()('@cv/facts-release/FactsReleasePublicationTarget') {}

export const publishFactsRelease = Effect.fn('FactsRelease.publish')(
  (bundle: CompiledFactsRelease, createdAt: string) =>
    Effect.gen(function* () {
      yield* verifyFactsReleaseBundle(bundle)
      const registration = yield* makeFactsReleaseRegistration(
        bundle,
        createdAt
      )
      const target = yield* FactsReleasePublicationTarget

      yield* Effect.forEach(
        bundle.objects,
        (object) =>
          target.putObject({ ...object, bytes: object.bytes.slice() }),
        { discard: true }
      )
      yield* target.register(registration)
      return registration
    })
)
