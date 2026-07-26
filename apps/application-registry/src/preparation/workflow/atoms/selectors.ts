import {
  applicationJobById,
  latestApplicationJob,
  latestOpenApplicationJob,
  type PreparationArtifact,
  type PreparationJob,
  preparationActivityProjection,
  selectPreparationArtifact,
} from '@cv/application-preparation-workflow/domain'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { preparationJobsAtom } from './runtime'

export type ApplicationPreparationIdentity = {
  readonly applicationId: string
  readonly kind: PreparationArtifact['kind']
  readonly locale: string
}

export const applicationPreparationIdentity = (
  applicationId: string,
  kind: PreparationArtifact['kind'],
  locale: string
): ApplicationPreparationIdentity => ({ applicationId, kind, locale })

export const preparationJobAtom = Atom.family((jobId: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(preparationJobsAtom), (jobs) => jobs.get(jobId) ?? null)
  )
)

export const preparationJobActivityAtom = Atom.family((jobId: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(preparationJobsAtom), (jobs) => {
      const job = jobs.get(jobId)
      return job === undefined ? null : preparationActivityProjection(job)
    })
  )
)

const artifactFromJob = (
  job: PreparationJob | null,
  identity: ApplicationPreparationIdentity
): PreparationArtifact | null =>
  job === null ? null : selectPreparationArtifact(job, identity.kind)

export const latestApplicationArtifactAtom = Atom.family(
  (identity: ApplicationPreparationIdentity) =>
    Atom.make((get) =>
      AsyncResult.map(get(preparationJobsAtom), (jobs) =>
        artifactFromJob(
          latestApplicationJob(jobs, identity.applicationId, identity.locale),
          identity
        )
      )
    )
)

export const latestOpenApplicationJobAtom = Atom.family(
  (identity: Omit<ApplicationPreparationIdentity, 'kind'>) =>
    Atom.make((get) =>
      AsyncResult.map(get(preparationJobsAtom), (jobs) =>
        latestOpenApplicationJob(jobs, identity.applicationId, identity.locale)
      )
    )
)

export {
  applicationJobById,
  latestApplicationJob,
  latestOpenApplicationJob,
  preparationActivityProjection,
  selectPreparationArtifact,
}
