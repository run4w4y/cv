import { Effect, Layer } from 'effect'

import {
  PreparationStore,
  PreparationStoreError,
  type PreparationStoreShape,
} from '../store'

const unimplemented = (operation: string) =>
  Effect.fail(
    new PreparationStoreError({
      message: `No test implementation was provided for ${operation}.`,
      operation,
    })
  )

export const makePreparationStoreTestLayer = (
  overrides: Partial<PreparationStoreShape> = {}
) =>
  Layer.succeed(
    PreparationStore,
    PreparationStore.of({
      appendRevision:
        overrides.appendRevision ?? (() => unimplemented('appendRevision')),
      approveRevision:
        overrides.approveRevision ?? (() => unimplemented('approveRevision')),
      createPreparationApplication:
        overrides.createPreparationApplication ??
        (() => unimplemented('createPreparationApplication')),
      loadContentEntry:
        overrides.loadContentEntry ?? (() => unimplemented('loadContentEntry')),
      loadContentRevisionHistory:
        overrides.loadContentRevisionHistory ??
        (() => unimplemented('loadContentRevisionHistory')),
      loadWorkflowBootstrap:
        overrides.loadWorkflowBootstrap ??
        (() => unimplemented('loadWorkflowBootstrap')),
      startPreparation:
        overrides.startPreparation ?? (() => unimplemented('startPreparation')),
      updatePreparationApplication:
        overrides.updatePreparationApplication ??
        (() => unimplemented('updatePreparationApplication')),
    })
  )
