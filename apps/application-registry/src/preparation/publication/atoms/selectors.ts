import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import type { CvPublicationIdentity, CvPublicationRun } from '../domain'
import { cvPublicationIdentityKey, publicationRunResult } from '../domain'
import { cvPublicationRunsAtom } from './runtime'

export const latestCvPublicationRun = (
  runs: ReadonlyMap<string, CvPublicationRun>,
  identity: CvPublicationIdentity
): CvPublicationRun | null => {
  let latest: CvPublicationRun | null = null
  const identityKey = cvPublicationIdentityKey(identity)
  for (const run of runs.values()) {
    if (cvPublicationIdentityKey(run) === identityKey) latest = run
  }
  return latest
}

const cvPublicationRunFamily = Atom.family((identity: CvPublicationIdentity) =>
  Atom.make((get) =>
    AsyncResult.map(get(cvPublicationRunsAtom), (runs) =>
      latestCvPublicationRun(runs, identity)
    )
  )
)

/** Stable progress/result projection keyed by application and CV entry. */
export const cvPublicationRunAtom = (identity: CvPublicationIdentity) =>
  cvPublicationRunFamily(identity)

const cvPublicationResultFamily = Atom.family(
  (identity: CvPublicationIdentity) =>
    Atom.make((get) =>
      AsyncResult.map(get(cvPublicationRunsAtom), (runs) =>
        publicationRunResult(latestCvPublicationRun(runs, identity))
      )
    )
)

/** Stable success-only projection for consumers that do not render progress. */
export const cvPublicationResultAtom = (identity: CvPublicationIdentity) =>
  cvPublicationResultFamily(identity)
