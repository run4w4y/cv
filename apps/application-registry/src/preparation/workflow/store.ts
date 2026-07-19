import {
  PreparationStore,
  PreparationStoreError,
} from '@cv/application-preparation-workflow'
import { Effect, Layer } from 'effect'
import { publicCvBaseUrl } from '@/preparation/config'
import { PreparationRepository } from '@/preparation/data/repository'

const storeOperation = (operation: string) =>
  Effect.mapError(
    (error: { readonly message: string; readonly operation: string }) =>
      new PreparationStoreError({
        message: error.message,
        operation: error.operation || operation,
      })
  )

export const preparationStoreLayer = Layer.effect(
  PreparationStore,
  Effect.gen(function* () {
    const repository = yield* PreparationRepository
    return PreparationStore.of({
      appendRevision: (input) =>
        repository.appendRevision(input).pipe(
          Effect.flatMap((result) =>
            result.entry.kind === 'cv'
              ? repository
                  .stageCv({
                    applicationId: input.applicationId,
                    entry: result.entry,
                    publicBaseUrl: publicCvBaseUrl(),
                    revisionId: result.revision.id,
                  })
                  .pipe(Effect.as(result))
              : Effect.succeed(result)
          ),
          storeOperation('appendRevision')
        ),
      approveRevision: (input) =>
        repository.approveRevision(input).pipe(
          Effect.flatMap((result) =>
            result.entry.kind === 'cv'
              ? repository
                  .stageCv({
                    applicationId: input.applicationId,
                    entry: result.entry,
                    publicBaseUrl: publicCvBaseUrl(),
                    revisionId: result.revision.id,
                  })
                  .pipe(Effect.as(result))
              : Effect.succeed(result)
          ),
          storeOperation('approveRevision')
        ),
      createPreparationApplication: (postingUrl) =>
        repository
          .createPreparationApplication(postingUrl)
          .pipe(storeOperation('createPreparationApplication')),
      loadContentEntry: (input) =>
        repository
          .loadContentEntry(input)
          .pipe(storeOperation('loadContentEntry')),
      loadContentRevisionHistory: (input) =>
        repository
          .loadContentRevisionHistory(input)
          .pipe(storeOperation('loadContentRevisionHistory')),
      loadWorkflowBootstrap: (input) =>
        repository
          .loadWorkflowBootstrap(input)
          .pipe(storeOperation('loadWorkflowBootstrap')),
      startPreparation: (applicationId) =>
        repository
          .startPreparation(applicationId)
          .pipe(storeOperation('startPreparation')),
      updatePreparationApplication: (input) =>
        repository
          .updatePreparationApplication(input)
          .pipe(storeOperation('updatePreparationApplication')),
    })
  })
)
