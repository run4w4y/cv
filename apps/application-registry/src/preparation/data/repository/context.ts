import type { JobPostingSnapshot } from '@cv/application-registry-entity'
import type { FactsReaderShape } from '@cv/facts-reader/reader'
import { Effect } from 'effect'

import type { RegistryClient } from '@/lib/registry-client'
import { startApplicationPreparation } from '@/preparation/application-lifecycle'
import type { PreparationContextIdentity, PreparationIdentity } from '../keys'
import type {
  PreparationRepositoryShape,
  WorkflowBootstrapInput,
} from '../types'
import { PreparationDataError } from '../types'
import { dataError, decodeOpaqueValue } from './shared'

export const makePreparationContextRepository = (
  registry: RegistryClient['Service'],
  facts: FactsReaderShape,
  loadContentHead: PreparationRepositoryShape['loadContentHead']
) => {
  const latestSnapshotOrNull = Effect.fn(
    'PreparationRepository.latestSnapshotOrNull'
  )((applicationId: string) =>
    registry.content
      .getLatestJobPostingSnapshot({ params: { id: applicationId } })
      .pipe(
        Effect.map((snapshot): JobPostingSnapshot | null => snapshot),
        Effect.catchTag('NotFoundError', () =>
          Effect.succeed<JobPostingSnapshot | null>(null)
        )
      )
  )

  const readOrCaptureSnapshot = Effect.fn(
    'PreparationRepository.readOrCaptureSnapshot'
  )(function* (applicationId: string) {
    const latest = yield* latestSnapshotOrNull(applicationId)
    if (latest !== null) return latest
    return yield* registry.content.captureJobPostingSnapshot({
      params: { id: applicationId },
    })
  })

  const loadSnapshotContext = Effect.fn(
    'PreparationRepository.loadSnapshotContext'
  )(function* (
    identity: PreparationContextIdentity,
    jobSnapshot: JobPostingSnapshot
  ) {
    if (jobSnapshot.status === 'failed') {
      return yield* Effect.fail(
        new PreparationDataError({
          message:
            jobSnapshot.errorMessage ?? 'The latest job snapshot failed.',
          operation: 'load-preparation-context',
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
        new PreparationDataError({
          message:
            'The latest job snapshot does not contain a readable payload.',
          operation: 'load-preparation-context',
        })
      )
    }

    const loaded = yield* Effect.all(
      {
        factsRelease: facts.read(identity.locale),
        jobPayload: registry.content.getJobPostingSnapshotPayload({
          params: {
            id: identity.applicationId,
            kind: payloadKind,
            snapshotId: jobSnapshot.id,
          },
        }),
      },
      { concurrency: 2 }
    )
    const factsCatalogue = loaded.factsRelease.catalogue
    if (factsCatalogue.locale !== identity.locale) {
      return yield* Effect.fail(
        new PreparationDataError({
          message: `Active facts locale ${factsCatalogue.locale} did not match requested locale ${identity.locale}.`,
          operation: 'load-preparation-context',
        })
      )
    }
    const jobContext = yield* decodeOpaqueValue(
      'decode-job-context',
      loaded.jobPayload,
      payloadKind === 'normalized'
        ? (jobSnapshot.normalizedMediaType ?? 'application/octet-stream')
        : (jobSnapshot.rawMediaType ?? 'application/octet-stream')
    )

    return {
      cvGenerationGuidance: loaded.factsRelease.generationGuidance,
      factsCatalogue,
      factsRelease: {
        id: loaded.factsRelease.releaseId,
        locales: loaded.factsRelease.manifest.catalogues.map(
          ({ locale }) => locale
        ),
        provenance: loaded.factsRelease.manifest.provenance,
      },
      factsReleaseId: loaded.factsRelease.releaseId,
      jobContext,
      jobSnapshot,
      locale: identity.locale,
    }
  })

  const loadContext = Effect.fn('PreparationRepository.loadContext')(
    function* (identity: PreparationContextIdentity) {
      const jobSnapshot = yield* readOrCaptureSnapshot(identity.applicationId)
      return yield* loadSnapshotContext(identity, jobSnapshot)
    },
    (effect) => effect.pipe(dataError('load-preparation-context'))
  )

  const loadWorkflowBootstrap = Effect.fn(
    'PreparationRepository.loadWorkflowBootstrap'
  )(
    function* (input: WorkflowBootstrapInput) {
      const jobSnapshot = yield* input.snapshotId === null
        ? registry.content.captureJobPostingSnapshot({
            params: { id: input.application.id },
          })
        : registry.content.getJobPostingSnapshot({
            params: {
              id: input.application.id,
              snapshotId: input.snapshotId,
            },
          })
      const loaded = yield* Effect.all(
        {
          context: loadSnapshotContext(
            { applicationId: input.application.id, locale: input.locale },
            jobSnapshot
          ),
          entry: registry.content.ensureContentEntry({
            params: {
              id: input.application.id,
              kind: input.kind,
              locale: input.locale,
            },
          }),
        },
        { concurrency: 2 }
      )
      return loaded
    },
    (effect) => effect.pipe(dataError('load-workflow-bootstrap'))
  )

  const loadBootstrap = Effect.fn('PreparationRepository.loadBootstrap')(
    function* (identity: PreparationIdentity) {
      const application = yield* startApplicationPreparation(
        registry,
        identity.applicationId
      ).pipe(dataError('start-application-preparation'))
      const loaded = yield* Effect.all(
        {
          context: loadContext(identity),
          entry: registry.content.ensureContentEntry({
            params: {
              id: identity.applicationId,
              kind: identity.kind,
              locale: identity.locale,
            },
          }),
        },
        { concurrency: 2 }
      )
      const head = yield* loadContentHead({
        applicationId: identity.applicationId,
        entryId: loaded.entry.id,
        revisionId: loaded.entry.headRevisionId,
      })
      return {
        application,
        context: loaded.context,
        entry: head?.entry ?? loaded.entry,
        head,
      }
    },
    (effect) => effect.pipe(dataError('load-preparation-bootstrap'))
  )

  const loadCvGenerationGuidance = Effect.fn(
    'PreparationRepository.loadCvGenerationGuidance'
  )(() =>
    facts.readGenerationGuidance().pipe(
      Effect.map((loaded) => ({
        factsReleaseId: loaded.releaseId,
        guidance: loaded.generationGuidance,
      })),
      dataError('load-cv-generation-guidance')
    )
  )

  return {
    loadBootstrap,
    loadContext,
    loadCvGenerationGuidance,
    loadWorkflowBootstrap,
  }
}
