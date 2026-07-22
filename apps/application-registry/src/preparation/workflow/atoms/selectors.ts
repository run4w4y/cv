import {
  applicationRunById,
  latestApplicationRun,
  latestOpenApplicationRun,
  type PreparationRun,
} from '@cv/application-preparation-workflow/domain'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { preparationRunsAtom } from './runtime'

export type ApplicationPreparationIdentity = {
  readonly applicationId: string
  readonly kind: PreparationRun['kind']
  readonly locale: string
}

export const applicationPreparationIdentity = (
  applicationId: string,
  kind: PreparationRun['kind'],
  locale: string
): ApplicationPreparationIdentity => ({ applicationId, kind, locale })

/** Narrow subscriptions for run cards and preparation workspaces. */
export const preparationRunAtom = Atom.family((runId: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(preparationRunsAtom), (runs) => runs.get(runId) ?? null)
  )
)

export const latestApplicationRunAtom = Atom.family(
  (identity: ApplicationPreparationIdentity) =>
    Atom.make((get) =>
      AsyncResult.map(get(preparationRunsAtom), (runs) =>
        latestApplicationRun(
          runs,
          identity.applicationId,
          identity.kind,
          identity.locale
        )
      )
    )
)

export const latestOpenApplicationRunAtom = Atom.family(
  (identity: ApplicationPreparationIdentity) =>
    Atom.make((get) =>
      AsyncResult.map(get(preparationRunsAtom), (runs) =>
        latestOpenApplicationRun(
          runs,
          identity.applicationId,
          identity.kind,
          identity.locale
        )
      )
    )
)

export { applicationRunById, latestApplicationRun, latestOpenApplicationRun }
