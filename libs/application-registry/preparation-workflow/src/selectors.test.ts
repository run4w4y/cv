import { describe, expect, test } from 'bun:test'

import type { PreparationRun } from './domain'
import {
  applicationRunById,
  latestApplicationRun,
  latestOpenApplicationRun,
} from './selectors'

const run = (
  runId: string,
  locale: string,
  kind: PreparationRun['kind'] = 'cv',
  status: 'queued' | 'running' | 'failed' = 'queued'
): PreparationRun => {
  const common = {
    applicationId: 'application-1',
    candidate: null,
    kind,
    locale,
    message: 'test',
    runId,
    url: 'https://jobs.example.test/role',
  } as const

  switch (status) {
    case 'queued':
      return { ...common, error: null, stage: 'queued', status }
    case 'running':
      return { ...common, error: null, stage: 'analysis', status }
    case 'failed':
      return { ...common, error: 'failed', stage: 'analysis', status }
  }
}

describe('preparation run selection', () => {
  test('isolates application runs by document kind and locale', () => {
    const runs = new Map([
      ['run-en', run('run-en', 'en')],
      ['run-ru', run('run-ru', 'ru')],
      ['run-letter', run('run-letter', 'en', 'cover_letter')],
    ])

    expect(latestApplicationRun(runs, 'application-1', 'cv', 'en')?.runId).toBe(
      'run-en'
    )
    expect(
      applicationRunById(runs, 'run-ru', 'application-1', 'cv', 'en')
    ).toBeNull()
    expect(
      applicationRunById(runs, 'run-letter', 'application-1', 'cv', 'en')
    ).toBeNull()
  })

  test('prefers the open review even when a stale run was requested', () => {
    const runs = new Map([
      ['run-old', run('run-old', 'en', 'cv', 'failed')],
      ['run-review', run('run-review', 'en', 'cv', 'running')],
    ])

    expect(
      latestOpenApplicationRun(runs, 'application-1', 'cv', 'en')?.runId
    ).toBe('run-review')
    expect(
      applicationRunById(runs, 'missing', 'application-1', 'cv', 'en')
    ).toBeNull()
  })
})
