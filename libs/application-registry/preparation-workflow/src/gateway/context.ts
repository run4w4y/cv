import type { Application } from '@cv/application-registry-entity'
import { CvDocumentV1Schema } from '@cv/contracts/document'
import { Effect, Schema } from 'effect'

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
import type { PreparationStoreShape } from '../store'
import { stageError } from './shared'

export const makePreparationContextGateway = (
  repository: PreparationStoreShape
) => {
  const ensureApplication = Effect.fn('PreparationGateway.ensureApplication')(
    function* (input: PreparationWorkflowInput) {
      const applicationId =
        input.source._tag === 'CaptureUrl'
          ? (yield* repository.createPreparationApplication(
              canonicalPreparationUrl(preparationSourceUrl(input.source))
            )).id
          : input.source.applicationId
      return yield* repository.startPreparation(applicationId)
    },
    (effect) => effect.pipe(stageError('application'))
  )

  const bootstrap = Effect.fn('PreparationGateway.bootstrap')(function* (
    input: PreparationWorkflowInput,
    application: Application
  ) {
    const loaded = yield* repository
      .loadWorkflowBootstrap({
        application,
        kind: input.kind,
        locale: input.locale,
        snapshotId:
          input.source._tag === 'ReviewedContext'
            ? input.source.jobSnapshotId
            : null,
      })
      .pipe(stageError('capture'))

    if (
      input.source._tag === 'ReviewedContext' &&
      (loaded.context.jobSnapshot.id !== input.source.jobSnapshotId ||
        canonicalPreparationUrl(input.source.url) !==
          canonicalPreparationUrl(application.postingUrl))
    ) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message:
            'The reviewed job snapshot no longer matches the selected application context.',
          stage: 'capture',
        })
      )
    }
    if (
      input.source._tag === 'ReviewedContext' &&
      loaded.context.factsReleaseId !== input.source.factsReleaseId
    ) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: `Reviewed facts release ${input.source.factsReleaseId} is no longer active. Refresh and review the preparation context before starting again.`,
          stage: 'facts',
        })
      )
    }

    const referenceCv =
      input.kind === 'cover_letter'
        ? yield* repository
            .loadPreparationHead({
              applicationId: application.id,
              kind: 'cv',
              locale: input.locale,
            })
            .pipe(stageError('capture'))
        : null
    if (
      input.kind === 'cover_letter' &&
      (referenceCv === null ||
        referenceCv.entry.state !== 'approved' ||
        referenceCv.entry.approvedRevisionId !== referenceCv.revision.id)
    ) {
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message:
            'Cover-letter generation requires a currently approved CV revision for this application and locale.',
          stage: 'capture',
        })
      )
    }
    const referenceCvDocument =
      referenceCv === null
        ? null
        : yield* Schema.decodeUnknownEffect(CvDocumentV1Schema)(
            referenceCv.value
          ).pipe(stageError('capture'))
    return {
      application,
      cvGenerationGuidance: loaded.context.cvGenerationGuidance,
      entry: loaded.entry,
      factsCatalogue: loaded.context.factsCatalogue,
      factsReleaseId: loaded.context.factsReleaseId,
      jobContext: loaded.context.jobContext,
      jobSnapshot: loaded.context.jobSnapshot,
      referenceCv: referenceCvDocument,
      referenceCvRevisionId: referenceCv?.revision.id ?? null,
    }
  })

  const enrichApplication = Effect.fn('PreparationGateway.enrichApplication')(
    function* (
      input: PreparationWorkflowInput,
      context: PreparationBootstrap,
      analysis: JobAnalysis
    ) {
      if (
        input.source._tag === 'ReviewedContext' ||
        input.kind === 'cover_letter'
      ) {
        return context.application
      }
      return yield* repository
        .updatePreparationApplication({
          application: context.application,
          company: analysis.company,
          location: analysis.location,
          operationId: `${input.runId}:application`,
          role: analysis.role,
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
