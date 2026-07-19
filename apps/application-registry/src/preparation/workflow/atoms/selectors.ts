import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import type { PreparationRun } from '../domain'
import { preparationRunsAtom } from './runtime'

export const latestApplicationRun = (
  runs: ReadonlyMap<string, PreparationRun>,
  applicationId: string,
  kind: PreparationRun['kind'],
  locale: string
): PreparationRun | null => {
  let latest: PreparationRun | null = null
  for (const run of runs.values()) {
    if (
      run.applicationId === applicationId &&
      run.kind === kind &&
      run.locale === locale
    ) {
      latest = run
    }
  }
  return latest
}

export const latestOpenApplicationRun = (
  runs: ReadonlyMap<string, PreparationRun>,
  applicationId: string,
  kind: PreparationRun['kind'],
  locale: string
): PreparationRun | null => {
  let latest: PreparationRun | null = null
  for (const run of runs.values()) {
    if (
      run.applicationId === applicationId &&
      run.kind === kind &&
      run.locale === locale &&
      (run.status === 'queued' ||
        run.status === 'running' ||
        run.status === 'awaiting_review' ||
        run.status === 'review_submitted' ||
        run.status === 'cancelling')
    ) {
      latest = run
    }
  }
  return latest
}

export const applicationRunById = (
  runs: ReadonlyMap<string, PreparationRun>,
  runId: string,
  applicationId: string,
  kind: PreparationRun['kind'],
  locale: string
): PreparationRun | null => {
  const run = runs.get(runId)
  return run?.applicationId === applicationId &&
    run.kind === kind &&
    run.locale === locale
    ? run
    : null
}

export const applicationPreparationIdentity = (
  applicationId: string,
  kind: PreparationRun['kind'],
  locale: string
): string => JSON.stringify([applicationId, kind, locale])

/** Narrow subscriptions for run cards and preparation workspaces. */
export const preparationRunAtom = Atom.family((runId: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(preparationRunsAtom), (runs) => runs.get(runId) ?? null)
  )
)

export const latestApplicationRunAtom = Atom.family((identity: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(preparationRunsAtom), (runs) => {
      let latest: PreparationRun | null = null
      for (const run of runs.values()) {
        if (
          run.applicationId !== null &&
          applicationPreparationIdentity(
            run.applicationId,
            run.kind,
            run.locale
          ) === identity
        ) {
          latest = run
        }
      }
      return latest
    })
  )
)

export const latestOpenApplicationRunAtom = Atom.family((identity: string) =>
  Atom.make((get) =>
    AsyncResult.map(get(preparationRunsAtom), (runs) => {
      let latest: PreparationRun | null = null
      for (const run of runs.values()) {
        if (
          run.applicationId !== null &&
          applicationPreparationIdentity(
            run.applicationId,
            run.kind,
            run.locale
          ) === identity &&
          (run.status === 'queued' ||
            run.status === 'running' ||
            run.status === 'awaiting_review' ||
            run.status === 'review_submitted' ||
            run.status === 'cancelling')
        ) {
          latest = run
        }
      }
      return latest
    })
  )
)
