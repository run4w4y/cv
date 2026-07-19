import type { PreparationRun } from './domain'

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
