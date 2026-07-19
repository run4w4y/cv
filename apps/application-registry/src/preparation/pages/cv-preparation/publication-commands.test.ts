import { describe, expect, test } from 'bun:test'
import type { CvLink } from '@cv/application-registry-entity'

import type { PublishedCvState } from '../../data'
import type { CvPublicationRun } from '../../publication'
import { resolveCurrentCvPublication } from './publication-view'

const publication = {
  artifact: {
    byteLength: 1_024,
    contentRevisionId: 'revision-1',
    createdAt: '2026-07-17T10:00:00.000Z',
    cvLinkId: 'link-1',
    errorCode: null,
    errorMessage: null,
    generatedAt: '2026-07-17T10:01:00.000Z',
    id: 'artifact-1',
    kind: 'pdf',
    mediaType: 'application/pdf',
    objectKey: 'sha256/pdf',
    publicationVersion: 1,
    qrTarget: 'https://cv.example.test/c/token',
    rendererVersion: 'cv-renderer.v1',
    sha256: 'a'.repeat(64),
    status: 'ready',
    updatedAt: '2026-07-17T10:01:00.000Z',
    requestId: 'request-1',
  },
  link: {
    applicationId: 'application-1',
    contentEntryId: 'entry-1',
    createdAt: '2026-07-17T10:00:00.000Z',
    disabledAt: null,
    disabledReason: null,
    enabled: true,
    id: 'link-1',
    publicationVersion: 1,
    publicUrl: 'https://cv.example.test/c/token',
    publishedRevisionId: 'revision-1',
    token: 'token',
    updatedAt: '2026-07-17T10:00:00.000Z',
    version: 1,
  },
} as const satisfies PublishedCvState

const publishedRun = (state: PublishedCvState): CvPublicationRun => ({
  _tag: 'Published',
  applicationId: state.link.applicationId,
  entryId: state.link.contentEntryId,
  executionId: 'execution-1',
  message: 'Published.',
  rendererVersion: state.artifact.rendererVersion,
  result: {
    applicationId: state.link.applicationId,
    artifact: state.artifact,
    entryId: state.link.contentEntryId,
    link: state.link,
    runId: 'run-1',
  },
  runId: 'run-1',
})

const disabledLink = (version: number): CvLink => ({
  ...publication.link,
  disabledAt: '2026-07-17T11:00:00.000Z',
  disabledReason: 'Disabled manually from CV preparation.',
  enabled: false,
  updatedAt: '2026-07-17T11:00:00.000Z',
  version,
})

describe('resolveCurrentCvPublication', () => {
  test('prefers a newer queried availability state over a terminal Workflow run', () => {
    const queried = { ...publication, link: disabledLink(2) }

    const resolved = resolveCurrentCvPublication({
      availabilityLink: null,
      publicationRun: publishedRun(publication),
      queriedPublication: queried,
    })

    expect(resolved).toBe(queried)
    expect(resolved?.link.enabled).toBe(false)
  })

  test('folds the latest availability mutation into the publication read model', () => {
    const queried = { ...publication, link: disabledLink(2) }
    const enabledLink: CvLink = {
      ...publication.link,
      updatedAt: '2026-07-17T12:00:00.000Z',
      version: 3,
    }

    const resolved = resolveCurrentCvPublication({
      availabilityLink: enabledLink,
      publicationRun: publishedRun(publication),
      queriedPublication: queried,
    })

    expect(resolved?.link).toBe(enabledLink)
    expect(resolved?.artifact).toBe(publication.artifact)
  })

  test('uses a newer Workflow publication while its query catches up', () => {
    const nextPublication: PublishedCvState = {
      artifact: {
        ...publication.artifact,
        contentRevisionId: 'revision-2',
        id: 'artifact-2',
        publicationVersion: 2,
      },
      link: {
        ...publication.link,
        publicationVersion: 2,
        publishedRevisionId: 'revision-2',
        version: 2,
      },
    }
    const run = publishedRun(nextPublication)

    const resolved = resolveCurrentCvPublication({
      availabilityLink: null,
      publicationRun: run,
      queriedPublication: publication,
    })

    expect(resolved?.link.publicationVersion).toBe(2)
    expect(resolved?.artifact.id).toBe('artifact-2')
  })
})
