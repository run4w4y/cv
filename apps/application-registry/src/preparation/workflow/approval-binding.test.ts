import { describe, expect, test } from 'bun:test'
import type {
  Application,
  ContentEntry,
  ContentRevision,
} from '@cv/application-registry-entity'
import { Effect } from 'effect'

import type { SavedCandidate } from './domain'
import {
  verifyApprovedRevisionBinding,
  verifyRevisionSelectionBinding,
} from './gateway'

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  canonicalUrl: 'https://jobs.example.test/role',
  company: 'Example',
  createdAt: '2026-07-18T00:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  jobKey: 'example:role',
  lastContactAt: null,
  listingAvailability: 'open',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  role: 'Platform Engineer',
  source: 'example',
  sourceJobId: 'role',
  targetStage: 'backlog',
  updatedAt: '2026-07-18T00:00:00.000Z',
  updatedRevision: 1,
  version: 1,
}

const draftEntry: ContentEntry = {
  applicationId: application.id,
  approvedRevisionId: null,
  createdAt: '2026-07-18T00:00:00.000Z',
  headRevisionId: 'revision-ai',
  id: 'entry-1',
  kind: 'cv',
  locale: 'en',
  state: 'draft',
  updatedAt: '2026-07-18T00:01:00.000Z',
  version: 2,
}

const candidateRevision: ContentRevision = {
  byteLength: 42,
  contentEntryId: draftEntry.id,
  contractId: 'cv.document.v1',
  contractVersion: '1',
  createdAt: '2026-07-18T00:01:00.000Z',
  factsReleaseId: 'facts-release-1',
  id: 'revision-ai',
  jobSnapshotId: 'snapshot-1',
  mediaType: 'application/json',
  objectKey: 'objects/revision-ai',
  operationId: 'run-1:candidate',
  parentRevisionId: null,
  revisionNumber: 1,
  sha256: 'abc',
  source: 'ai',
}

const candidate: SavedCandidate = {
  application,
  candidate: {
    _tag: 'Cv',
    document: {
      $schema: 'cv.document.v1',
      additionalSections: [],
      direction: 'ltr',
      education: [],
      experience: [],
      locale: 'en',
      person: {
        contacts: [],
        headline: 'Platform engineer',
        name: 'Ada Example',
        summary: 'Builds reliable systems.',
      },
      projects: [],
      skills: [],
    },
    metadata: [],
  },
  result: { entry: draftEntry, revision: candidateRevision },
}

const humanRevision = (
  id: string,
  parent: ContentRevision
): ContentRevision => ({
  ...candidateRevision,
  createdAt: '2026-07-18T00:02:00.000Z',
  id,
  objectKey: `objects/${id}`,
  operationId: `${id}:save`,
  parentRevisionId: parent.id,
  revisionNumber: parent.revisionNumber + 1,
  source: 'human',
})

const approvedEntry = (revisionId: string, version = 3): ContentEntry => ({
  ...draftEntry,
  approvedRevisionId: revisionId,
  headRevisionId: revisionId,
  state: 'approved',
  version,
})

describe('server-backed workflow approval binding', () => {
  test('accepts the generated candidate and a human descendant chain', async () => {
    const firstEdit = humanRevision('revision-human-1', candidateRevision)
    const secondEdit = humanRevision('revision-human-2', firstEdit)

    const selected = await Effect.runPromise(
      verifyRevisionSelectionBinding(
        candidate,
        secondEdit.id,
        {
          ...draftEntry,
          headRevisionId: secondEdit.id,
          version: 4,
        },
        [candidateRevision, firstEdit, secondEdit]
      )
    )
    const direct = await Effect.runPromise(
      verifyApprovedRevisionBinding(
        candidate,
        candidateRevision.id,
        approvedEntry(candidateRevision.id),
        [candidateRevision]
      )
    )
    const edited = await Effect.runPromise(
      verifyApprovedRevisionBinding(
        candidate,
        secondEdit.id,
        approvedEntry(secondEdit.id, 5),
        [candidateRevision, firstEdit, secondEdit]
      )
    )

    expect(selected.revision.id).toBe(secondEdit.id)
    expect(direct.revision.id).toBe(candidateRevision.id)
    expect(edited.revision.id).toBe(secondEdit.id)
  })

  test('requires the selected revision to remain the approved head', async () => {
    const error = await Effect.runPromise(
      verifyApprovedRevisionBinding(
        candidate,
        candidateRevision.id,
        { ...approvedEntry(candidateRevision.id), state: 'draft' },
        [candidateRevision]
      ).pipe(Effect.flip)
    )

    expect(error.stage).toBe('review')
    expect(error.message).toContain('currently approved head')
  })

  test('rejects non-human ancestry and changed provenance pins', async () => {
    const adjusted: ContentRevision = {
      ...humanRevision('revision-adjusted', candidateRevision),
      source: 'ai_adjustment',
    }
    const changedPins: ContentRevision = {
      ...humanRevision('revision-human', candidateRevision),
      factsReleaseId: 'facts-release-other',
    }

    const nonHumanError = await Effect.runPromise(
      verifyApprovedRevisionBinding(
        candidate,
        adjusted.id,
        approvedEntry(adjusted.id),
        [candidateRevision, adjusted]
      ).pipe(Effect.flip)
    )
    const pinError = await Effect.runPromise(
      verifyApprovedRevisionBinding(
        candidate,
        changedPins.id,
        approvedEntry(changedPins.id),
        [candidateRevision, changedPins]
      ).pipe(Effect.flip)
    )

    expect(nonHumanError.message).toContain('not a human edit')
    expect(pinError.message).toContain('contract or provenance pins')
  })

  test('rejects a human head descended through another AI revision', async () => {
    const otherAi: ContentRevision = {
      ...humanRevision('revision-other-ai', candidateRevision),
      source: 'ai_adjustment',
    }
    const selected = humanRevision('revision-human-after-ai', otherAi)

    const error = await Effect.runPromise(
      verifyRevisionSelectionBinding(
        candidate,
        selected.id,
        { ...draftEntry, headRevisionId: selected.id, version: 4 },
        [candidateRevision, otherAi, selected]
      ).pipe(Effect.flip)
    )

    expect(error.message).toContain(`Revision ${otherAi.id}`)
    expect(error.message).toContain('not a human edit')
  })

  test('bounds the number of accepted human descendants', async () => {
    const chain: Array<ContentRevision> = [candidateRevision]
    for (let index = 1; index <= 33; index += 1) {
      const parent = chain[index - 1]
      if (parent === undefined) throw new Error('missing parent fixture')
      chain.push(humanRevision(`revision-human-${index}`, parent))
    }
    const selected = chain.at(-1)
    if (selected === undefined) throw new Error('missing selected fixture')

    const error = await Effect.runPromise(
      verifyApprovedRevisionBinding(
        candidate,
        selected.id,
        approvedEntry(selected.id, 36),
        chain
      ).pipe(Effect.flip)
    )

    expect(error.message).toContain('more than 32 human edits')
  })
})
