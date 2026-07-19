import type { Application } from '@cv/application-registry-entity'
import { FactsCatalogueV1Schema } from '@cv/contracts/facts'
import { type Crypto, Effect, Schema } from 'effect'

import type { RegistryClient } from '../../../lib/registry-client'
import { startApplicationPreparation } from '../../application-lifecycle'
import type {
  JobAnalysis,
  PreparationBootstrap,
  PreparationWorkflowInput,
} from '../domain'
import {
  canonicalPreparationUrl,
  PreparationWorkflowError,
  preparationSourceUrl,
} from '../domain'
import { asJson, decodeOpaqueValue, stageError } from './shared'

export const makePreparationContextGateway = (
  registry: RegistryClient['Service'],
  crypto: Crypto.Crypto
) => {
  const createApplication = Effect.fn('PreparationGateway.createApplication')(
    function* (input: PreparationWorkflowInput) {
      const canonicalUrl = canonicalPreparationUrl(
        preparationSourceUrl(input.source)
      )
      const url = new URL(canonicalUrl)
      const digest = yield* crypto.digest(
        'SHA-256',
        new TextEncoder().encode(canonicalUrl)
      )
      const stableUrlId = Array.from(digest, (byte) =>
        byte.toString(16).padStart(2, '0')
      ).join('')
      const jobKey = `workflow:url:${stableUrlId}`
      return yield* registry.registry
        .getApplication({ params: { id: jobKey } })
        .pipe(
          Effect.catchTag('NotFoundError', () =>
            registry.registry.upsertApplication({
              payload: {
                applicationStatus: 'preparing',
                canonicalUrl,
                company: url.hostname,
                jobKey,
                location: null,
                role: 'Pending job analysis',
                source: url.hostname,
                sourceJobId: null,
                targetStage: 'backlog',
              },
            })
          )
        )
    }
  )

  const ensureApplication = Effect.fn('PreparationGateway.ensureApplication')(
    (input: PreparationWorkflowInput) =>
      (input.source._tag === 'CaptureUrl'
        ? createApplication(input).pipe(
            Effect.flatMap((application) =>
              startApplicationPreparation(registry, application.id)
            )
          )
        : startApplicationPreparation(registry, input.source.applicationId)
      ).pipe(stageError('application'))
  )

  const bootstrap = Effect.fn('PreparationGateway.bootstrap')(function* (
    input: PreparationWorkflowInput,
    application: Application
  ) {
    const jobSnapshot = yield* (
      input.source._tag === 'CaptureUrl'
        ? registry.registry.captureJobPostingSnapshot({
            params: { id: application.id },
          })
        : registry.registry.getJobPostingSnapshot({
            params: {
              id: application.id,
              snapshotId: input.source.jobSnapshotId,
            },
          })
    ).pipe(stageError('capture'))
    if (
      input.source._tag === 'ReviewedContext' &&
      (jobSnapshot.id !== input.source.jobSnapshotId ||
        canonicalPreparationUrl(input.source.url) !==
          canonicalPreparationUrl(application.canonicalUrl))
    ) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message:
            'The reviewed job snapshot no longer matches the selected application context.',
          stage: 'capture',
        })
      )
    }
    if (jobSnapshot.status === 'failed') {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: jobSnapshot.errorMessage ?? 'The job capture failed.',
          stage: 'capture',
        })
      )
    }
    const payloadKind =
      jobSnapshot.normalizedObjectKey !== null
        ? 'normalized'
        : jobSnapshot.rawObjectKey !== null
          ? 'raw'
          : null
    if (payloadKind === null) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: 'The captured job does not have a readable payload.',
          stage: 'capture',
        })
      )
    }

    const loaded = yield* Effect.all(
      {
        entry: registry.registry.ensureContentEntry({
          params: { id: application.id },
          payload: { kind: input.kind, locale: input.locale },
        }),
        facts: registry.registry.getActiveFactsRelease({
          query: { locale: input.locale },
        }),
        jobPayload: registry.registry.getJobPostingSnapshotPayload({
          params: {
            id: application.id,
            kind: payloadKind,
            snapshotId: jobSnapshot.id,
          },
        }),
      },
      { concurrency: 3 }
    ).pipe(stageError('capture'))
    if (
      input.source._tag === 'ReviewedContext' &&
      loaded.facts.release.id !== input.source.factsReleaseId
    ) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Reviewed facts release ${input.source.factsReleaseId} is no longer active. Refresh and review the preparation context before starting again.`,
          stage: 'facts',
        })
      )
    }
    const factsValue = yield* decodeOpaqueValue('facts', loaded.facts.catalogue)
    const factsCatalogue = yield* Schema.decodeUnknownEffect(
      FactsCatalogueV1Schema
    )(factsValue).pipe(stageError('facts'))
    if (factsCatalogue.locale !== input.locale) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Active facts locale ${factsCatalogue.locale} did not match requested locale ${input.locale}.`,
          stage: 'facts',
        })
      )
    }
    const jobValue = yield* decodeOpaqueValue('capture', loaded.jobPayload)
    const jobContext = yield* asJson('capture', jobValue)

    return {
      application,
      entry: loaded.entry,
      factsCatalogue,
      factsReleaseId: loaded.facts.release.id,
      jobContext,
      jobSnapshot,
    }
  })

  const enrichApplication = Effect.fn('PreparationGateway.enrichApplication')(
    function* (
      input: PreparationWorkflowInput,
      context: PreparationBootstrap,
      analysis: JobAnalysis
    ) {
      if (input.source._tag === 'ReviewedContext') {
        return context.application
      }
      return yield* registry.registry
        .patchApplication({
          params: { id: context.application.id },
          payload: {
            company: analysis.company ?? context.application.company,
            expectedVersion: context.application.version,
            location: analysis.location,
            role: analysis.role,
          },
        })
        .pipe(stageError('application'))
    }
  )

  return {
    bootstrap,
    enrichApplication,
    ensureApplication,
  }
}
