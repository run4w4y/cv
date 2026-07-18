import {
  ApplicationsCrud,
  CapturesCrud,
  OperationsCrud,
  type PersistedCapture,
} from '@cv/application-registry-crud'
import { normalizeApplicationCanonicalUrl } from '@cv/application-registry-entity'
import { Effect, Layer } from 'effect'
import { RegistryConflictError } from '../errors'
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

          const canonicalUrl = normalizeApplicationCanonicalUrl(
            request.canonicalUrl
          )
          const existing = yield* applications.findByJobKey(request.jobKey)
          const canonicalMatches = existing
            ? []
            : yield* applications.findByCanonicalUrl(canonicalUrl)
          const resolution = request.identityResolution
          const resolved = yield* existing
            ? Effect.succeed({
                application: existing,
                identityAlias: undefined,
                writeMode: 'capture' as const,
              })
            : canonicalMatches.length === 0
              ? Effect.succeed({
                  application: undefined,
                  identityAlias: undefined,
                  writeMode: 'capture' as const,
                })
              : resolution?.strategy === 'keep-both'
                ? Effect.succeed({
                    application: undefined,
                    identityAlias: undefined,
                    writeMode: 'capture' as const,
                  })
                : resolution?.strategy === 'merge' ||
                    resolution?.strategy === 'replace'
                  ? Effect.gen(function* () {
                      const target = canonicalMatches.find(
                        (application) =>
                          application.id === resolution.applicationId
                      )
                      if (!target) {
                        return yield* new RegistryConflictError({
                          message:
                            'The selected identity-conflict application is no longer a candidate.',
                        })
                      }
                      if (target.version !== resolution.expectedVersion) {
                        return yield* new RegistryConflictError({
                          message: `Application version ${target.version} does not match identity resolution version ${resolution.expectedVersion}.`,
                        })
                      }
                      return {
                        application: target,
                        identityAlias: request.jobKey,
                        writeMode:
                          resolution.strategy === 'replace'
                            ? ('replace' as const)
                            : ('capture' as const),
                      }
                    })
                  : Effect.fail(
                      new RegistryConflictError({
                        message: `Canonical URL ${canonicalUrl} already belongs to ${canonicalMatches
                          .map(
                            (application) =>
                              `${application.id} (${application.jobKey}, version ${application.version})`
                          )
                          .join(
                            ', '
                          )}. Supply an explicit identity resolution.`,
                      })
                    )
          const applicationId = resolved.application?.id ?? newRegistryId()
          const eventId = newRegistryId()
          const captureId = newRegistryId()
          const recordedAt = yield* registryNow
          const { identityResolution: _, ...captureRequest } = request
          const input: PersistedCapture = {
            ...captureRequest,
            applicationId,
            canonicalUrl,
            captureId,
            compensations: decorateCompensations(request.compensations),
            eventId,
            fitAssessment: request.fitAssessment ?? null,
            identityAlias: resolved.identityAlias,
            jobKey: resolved.application?.jobKey ?? request.jobKey,
            recordedAt,
            operationRequestSignature: identity.operationRequestSignature,
            writeMode: resolved.writeMode,
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
