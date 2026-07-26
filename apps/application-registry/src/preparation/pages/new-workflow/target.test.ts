import { describe, expect, test } from 'bun:test'

import { existingApplicationWorkflowTarget } from './target'

describe('existing application AI workflow target', () => {
  test('pins the application, current job snapshot, facts release, and URL', () => {
    expect(
      existingApplicationWorkflowTarget(
        {
          id: 'application-1',
          postingUrl: 'https://jobs.example.test/staff-engineer',
        },
        {
          factsReleaseId: 'facts-2026-07-24',
          jobSnapshot: {
            id: 'snapshot-4',
          },
        }
      )
    ).toEqual({
      _tag: 'ExistingApplication',
      applicationId: 'application-1',
      factsReleaseId: 'facts-2026-07-24',
      jobSnapshotId: 'snapshot-4',
      url: 'https://jobs.example.test/staff-engineer',
    })
  })
})
