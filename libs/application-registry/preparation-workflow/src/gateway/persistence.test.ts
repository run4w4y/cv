import { describe, expect, test } from 'bun:test'
import type {
  Application,
  ContentEntry,
  ContentRevision,
  JobPostingSnapshot,
} from '@cv/application-registry-entity'
import type { CvDocumentV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'

import type { SavedCandidate } from '../domain'
import type { PreparationStoreShape } from '../store'
import { cvGenerationGuidanceTestFixture } from '../test-support'
import { makePreparationPersistenceGateway } from './persistence'

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  company: 'Example',
  createdAt: '2026-07-24T00:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  listingAvailability: 'open',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  postingUrl: 'https://jobs.example.test/platform',
  role: 'Platform Engineer',
  targetStage: 'backlog',
  updatedAt: '2026-07-24T00:00:00.000Z',
  updatedRevision: 1,
  version: 1,
}

const candidateEntry: ContentEntry = {
  applicationId: application.id,
  approvedRevisionId: null,
  createdAt: application.createdAt,
  headRevisionId: 'revision-ai',
  id: 'entry-cv',
  kind: 'cv',
  locale: 'en',
  state: 'draft',
  updatedAt: application.updatedAt,
  version: 2,
}

const candidateRevision: ContentRevision = {
  byteLength: 42,
  contentEntryId: candidateEntry.id,
  contractId: 'cv.document.v1',
  contractVersion: '1',
  createdAt: '2026-07-24T00:01:00.000Z',
  factsReleaseId: 'facts-release-1',
  id: 'revision-ai',
  jobSnapshotId: 'snapshot-1',
  mediaType: 'application/json',
  objectKey: 'objects/revision-ai',
  operationId: 'run-1:candidate',
  parentRevisionId: null,
  revisionNumber: 1,
  sha256: 'candidate-sha',
  source: 'ai',
}

const selectedRevision: ContentRevision = {
  ...candidateRevision,
  createdAt: '2026-07-24T00:02:00.000Z',
  id: 'revision-human',
  objectKey: 'objects/revision-human',
  operationId: 'review-save-1',
  parentRevisionId: candidateRevision.id,
  revisionNumber: 2,
  sha256: 'selected-sha',
  source: 'human',
}

const selectedEntry: ContentEntry = {
  ...candidateEntry,
  headRevisionId: selectedRevision.id,
  updatedAt: selectedRevision.createdAt,
  version: 3,
}

const approvedEntry: ContentEntry = {
  ...selectedEntry,
  approvedRevisionId: selectedRevision.id,
  state: 'approved',
  version: 4,
}

const jobSnapshot: JobPostingSnapshot = {
  applicationId: application.id,
  errorCode: null,
  errorMessage: null,
  fetchedAt: application.createdAt,
  fetcherVersion: 'test/v1',
  finalUrl: application.postingUrl,
  id: 'snapshot-1',
  normalizedByteLength: 12,
  normalizedMediaType: 'text/plain',
  normalizedObjectKey: 'objects/snapshot-1',
  normalizedSha256: 'job-sha',
  rawByteLength: null,
  rawMediaType: null,
  rawObjectKey: null,
  rawSha256: null,
  requestedUrl: application.postingUrl,
  status: 'fetched',
}

const factsCatalogue: FactsCatalogueV1 = {
  $schema: 'cv.facts.v1',
  assets: [],
  evidence: [],
  locale: 'en',
  sections: [
    {
      facts: [],
      kind: 'identity',
      languages: [],
      name: 'Ada Example',
    },
    {
      items: [
        {
          id: 'contact.email',
          kind: 'email',
          label: 'Work email',
          url: 'mailto:ada@example.test',
          value: 'ada@example.test',
          visibility: 'public',
        },
      ],
      kind: 'contact',
    },
    {
      entries: [
        {
          contributions: [],
          id: 'project.registry',
          links: [
            {
              id: 'project.registry.links.0',
              label: 'Project site',
              url: 'https://projects.example.test/registry',
              visibility: 'public',
            },
          ],
          name: 'Registry Toolkit',
          summary: {
            id: 'project.registry.summary',
            text: 'A registry toolkit.',
          },
          technologies: [],
          visibility: 'public',
        },
      ],
      kind: 'projects',
    },
  ],
}

const validDocument: CvDocumentV1 = {
  $schema: 'cv.document.v1',
  additionalSections: [],
  direction: 'ltr',
  education: [],
  experience: [],
  locale: 'en',
  person: {
    contacts: [
      {
        href: 'mailto:ada@example.test',
        kind: 'email',
        label: 'Work email',
        value: 'ada@example.test',
      },
    ],
    headline: 'Platform engineer',
    name: 'Ada Example',
    summary: 'Builds reliable systems.',
  },
  projects: [
    {
      highlights: [],
      id: 'project.registry',
      links: [
        {
          href: 'https://projects.example.test/registry',
          kind: 'website',
          label: 'Project site',
          value: 'Project site',
        },
      ],
      name: 'Registry Toolkit',
      summary: 'A registry toolkit.',
      technologies: [],
    },
  ],
  skills: [],
}

const candidate: SavedCandidate = {
  application,
  candidate: {
    _tag: 'Cv',
    document: validDocument,
    metadata: [],
  },
  result: {
    entry: candidateEntry,
    revision: candidateRevision,
  },
}

const unimplemented = () => Effect.die('unexpected store operation')

const makeRepository = (
  value: unknown,
  approveCalls: { count: number }
): PreparationStoreShape => ({
  appendRevision: unimplemented,
  approveRevision: () =>
    Effect.sync(() => {
      approveCalls.count += 1
      return { entry: approvedEntry, revision: selectedRevision }
    }),
  createPreparationApplication: unimplemented,
  loadContentEntry: unimplemented,
  loadContentRevision: () =>
    Effect.succeed({
      entry: selectedEntry,
      revision: selectedRevision,
      value,
    }),
  loadContentRevisionHistory: () =>
    Effect.succeed({
      entry: selectedEntry,
      revisions: [candidateRevision, selectedRevision],
    }),
  loadPreparationHead: unimplemented,
  loadWorkflowBootstrap: () =>
    Effect.succeed({
      context: {
        cvGenerationGuidance: cvGenerationGuidanceTestFixture,
        factsCatalogue,
        factsReleaseId: 'facts-release-1',
        jobContext: 'Platform role',
        jobSnapshot,
      },
      entry: selectedEntry,
    }),
  startPreparation: unimplemented,
  updatePreparationApplication: unimplemented,
})

describe('workflow approval persistence boundary', () => {
  test('approves an exact stored revision that passes schema and provenance validation', async () => {
    const approveCalls = { count: 0 }
    const gateway = makePreparationPersistenceGateway(
      makeRepository(
        {
          ...validDocument,
          person: {
            ...validDocument.person,
            headline: 'Principal platform engineer',
          },
        },
        approveCalls
      )
    )

    const approved = await Effect.runPromise(
      gateway.approveBoundRevision(candidate, selectedRevision.id)
    )

    expect(approved.entry).toEqual(approvedEntry)
    expect(approved.revision).toEqual(selectedRevision)
    expect(approveCalls.count).toBe(1)
  })

  test('refuses approval when the exact stored value invents copied facts', async () => {
    const approveCalls = { count: 0 }
    const gateway = makePreparationPersistenceGateway(
      makeRepository(
        {
          ...validDocument,
          person: {
            ...validDocument.person,
            name: 'Invented Person',
          },
        },
        approveCalls
      )
    )

    const error = await Effect.runPromise(
      gateway
        .approveBoundRevision(candidate, selectedRevision.id)
        .pipe(Effect.flip)
    )

    expect(error.stage).toBe('validation')
    expect(error.message).toContain(
      'person.name was not copied from reviewed identity metadata'
    )
    expect(approveCalls.count).toBe(0)
  })

  test('refuses approval when exact stored contact fields were changed', async () => {
    const approveCalls = { count: 0 }
    const gateway = makePreparationPersistenceGateway(
      makeRepository(
        {
          ...validDocument,
          person: {
            ...validDocument.person,
            contacts: [
              {
                kind: 'phone',
                label: 'Invented label',
                value: 'ada@example.test',
              },
            ],
          },
        },
        approveCalls
      )
    )

    const error = await Effect.runPromise(
      gateway
        .approveBoundRevision(candidate, selectedRevision.id)
        .pipe(Effect.flip)
    )

    expect(error.stage).toBe('validation')
    expect(error.message).toContain('contact:contact.email.kind was changed')
    expect(error.message).toContain('contact:contact.email.href was changed')
    expect(error.message).toContain('contact:contact.email.label was changed')
    expect(approveCalls.count).toBe(0)
  })

  test('refuses approval when exact stored project-link fields were changed', async () => {
    const approveCalls = { count: 0 }
    const gateway = makePreparationPersistenceGateway(
      makeRepository(
        {
          ...validDocument,
          projects: validDocument.projects.map((project) => ({
            ...project,
            links: project.links.map((link) => ({
              ...link,
              label: 'Invented label',
              value: 'Invented value',
            })),
          })),
        },
        approveCalls
      )
    )

    const error = await Effect.runPromise(
      gateway
        .approveBoundRevision(candidate, selectedRevision.id)
        .pipe(Effect.flip)
    )

    expect(error.stage).toBe('validation')
    expect(error.message).toContain(
      'project:project.registry.link:0.label was changed'
    )
    expect(error.message).toContain(
      'project:project.registry.link:0.value was changed'
    )
    expect(approveCalls.count).toBe(0)
  })
})
