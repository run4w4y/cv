import {
  ApplicationsCrud,
  CapturesCrud,
  OperationsCrud,
  type PersistedCapture,
} from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'

import { operationRequestSignature } from '../internal/operation-request-signature'
import {
  decorateCompensations,
  findRequiredApplication,
  findValidatedOperation,
  missingRegistryData,
  newRegistryId,
  type OperationIdentity,
  recoverConcurrentReplay,
  registryNow,
  requireCapture,
} from '../internal/shared'
import {
  CapturesService,
  type CapturesService as CapturesServiceShape,
} from '../services/captures'
import type { CreateCampaignCaptureInput } from '../types'

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const captures = yield* CapturesCrud
  const operations = yield* OperationsCrud

  const loadResult = (identity: OperationIdentity, replayed: boolean) =>
    Effect.gen(function* () {
      const receipt = yield* findValidatedOperation(operations, identity)
      if (!receipt) {
        return yield* Effect.fail(
          missingRegistryData('Capture receipt disappeared.')
        )
      }
      const application = yield* findRequiredApplication(
        applications,
        receipt.applicationId
      )
      const capture = yield* captures
        .findByOperation(identity.operationId)
        .pipe(
          Effect.flatMap((value) => requireCapture(value, identity.operationId))
        )
      return { application, capture, replayed }
    })

  const persistWithRaceRecovery = (
    identity: OperationIdentity,
    input: PersistedCapture
  ) =>
    recoverConcurrentReplay(operations, identity, captures.persist(input)).pipe(
      Effect.catchTag('RegistryDatabaseError', (failure) =>
        applications
          .findByJobKey(input.jobKey)
          .pipe(
            Effect.flatMap((winner) =>
              winner && winner.id !== input.applicationId
                ? recoverConcurrentReplay(
                    operations,
                    identity,
                    captures.persist({ ...input, applicationId: winner.id })
                  )
                : Effect.fail(failure)
            )
          )
      )
    )

  return {
    capture: Effect.fn('CapturesService.capture')(
      (request: CreateCampaignCaptureInput) =>
        Effect.gen(function* () {
          const identity: OperationIdentity = {
            kind: 'campaign_capture',
            operationId: request.operationId,
            operationRequestSignature: operationRequestSignature(
              'campaign_capture',
              request
            ),
          }
          const replay = yield* findValidatedOperation(operations, identity)
          if (replay) return yield* loadResult(identity, true)

          const existing = yield* applications.findByJobKey(request.jobKey)
          const applicationId = existing?.id ?? newRegistryId()
          const eventId = newRegistryId()
          const captureId = newRegistryId()
          const recordedAt = yield* registryNow
          const input: PersistedCapture = {
            ...request,
            applicationId,
            captureId,
            compensations: decorateCompensations(request.compensations),
            eventId,
            recordedAt,
            operationRequestSignature: identity.operationRequestSignature,
          }
          const replayed = yield* persistWithRaceRecovery(identity, input)
          return yield* loadResult(identity, replayed)
        })
    ),
    listByApplication: Effect.fn('CapturesService.listByApplication')(
      (identifier: string) =>
        Effect.gen(function* () {
          const application = yield* findRequiredApplication(
            applications,
            identifier
          )
          return { items: yield* captures.listByApplication(application.id) }
        })
    ),
  } satisfies CapturesServiceShape
})

export const CapturesServiceLive = Layer.effect(CapturesService, make)
