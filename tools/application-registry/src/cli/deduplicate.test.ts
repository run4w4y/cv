import { describe, expect, test } from 'bun:test'
import type { ListApplicationsResponse } from '@cv/application-registry-api-contract'
import {
  decideRegistryDuplicateGroup,
  findRegistryDuplicateGroups,
} from './deduplicate'

type ApplicationItem = ListApplicationsResponse['items'][number]

const application = (
  id: string,
  canonicalUrl: string,
  createdAt: string
): ApplicationItem =>
  ({
    applicationStatus: 'preparing',
    appliedAt: null,
    annualCompensation: null,
    canonicalUrl,
    company: 'Acme',
    counts: { notes: 0 },
    createdAt,
    followUpAt: null,
    id,
    identityAliases: [],
    jobKey: `test:${id}`,
    labels: [],
    lastContactAt: null,
    latestEvent: null,
    listingAvailability: 'unchecked',
    listingCheckedAt: null,
    listingClosedCandidateAt: null,
    listingConfidence: null,
    listingConsecutiveClosedChecks: 0,
    listingReasonCode: null,
    location: null,
    personalPriority: null,
    role: 'Engineer',
    source: 'test',
    sourceJobId: null,
    targetStage: 'apply_next',
    updatedAt: createdAt,
    updatedRevision: 1,
    version: 1,
  }) satisfies ApplicationItem

describe('application registry deduplication', () => {
  test('groups tracking variants under one normalized canonical URL', () => {
    const groups = findRegistryDuplicateGroups([
      application(
        'older',
        'https://jobs.example.com/role?utm_source=mail',
        '2026-07-01T00:00:00.000Z'
      ),
      application(
        'newer',
        'https://jobs.example.com/role',
        '2026-07-02T00:00:00.000Z'
      ),
      application(
        'other',
        'https://jobs.example.com/other',
        '2026-07-03T00:00:00.000Z'
      ),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.canonicalUrl).toBe('https://jobs.example.com/role')
  })

  test('supports deterministic oldest, newest, and keep-both decisions', () => {
    const group = findRegistryDuplicateGroups([
      application(
        'older',
        'https://jobs.example.com/role',
        '2026-07-01T00:00:00.000Z'
      ),
      application(
        'newer',
        'https://jobs.example.com/role',
        '2026-07-02T00:00:00.000Z'
      ),
    ])[0]
    if (!group) throw new Error('Expected duplicate group')

    expect(decideRegistryDuplicateGroup(group, 'keep-oldest').keep[0]?.id).toBe(
      'older'
    )
    expect(decideRegistryDuplicateGroup(group, 'keep-newest').keep[0]?.id).toBe(
      'newer'
    )
    expect(decideRegistryDuplicateGroup(group, 'keep-both').delete).toEqual([])
  })
})
