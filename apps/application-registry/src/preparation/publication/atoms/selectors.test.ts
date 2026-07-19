import { describe, expect, test } from 'bun:test'

import type { CvPublicationRun } from '../domain'
import {
  cvPublicationResultAtom,
  cvPublicationRunAtom,
  latestCvPublicationRun,
} from './selectors'

const queued = (runId: string, entryId: string): CvPublicationRun => ({
  _tag: 'Queued',
  applicationId: 'application-1',
  entryId,
  executionId: `execution-${runId}`,
  message: 'queued',
  runId,
})

describe('CV publication atom projections', () => {
  test('uses stable value identities for run and result families', () => {
    const identity = {
      applicationId: 'application-1',
      entryId: 'entry-1',
    }

    expect(cvPublicationRunAtom(identity)).toBe(
      cvPublicationRunAtom({ ...identity })
    )
    expect(cvPublicationResultAtom(identity)).toBe(
      cvPublicationResultAtom({ ...identity })
    )
  })

  test('selects the latest run for the requested entry only', () => {
    const runs = new Map([
      ['run-old', queued('run-old', 'entry-1')],
      ['run-other', queued('run-other', 'entry-2')],
      ['run-new', queued('run-new', 'entry-1')],
    ])

    expect(
      latestCvPublicationRun(runs, {
        applicationId: 'application-1',
        entryId: 'entry-1',
      })?.runId
    ).toBe('run-new')
  })
})
