import { describe, expect, test } from 'bun:test'
import type { CvLink } from '@cv/application-registry-entity'

import type { CvPageState } from '@/preparation/data'
import {
  type CvPublicationRun,
  currentCvPdfArtifact,
  cvPublicationCanGeneratePdf,
  cvPublicationHasReadyPdf,
  cvPublicationIsShareable,
} from '@/preparation/publication'
import { resolveCurrentCvPage } from './publication-view'

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
    rendererVersion: 'cv-render.v1:deployment-1',
    requestId: 'request-1',
    sha256: 'a'.repeat(64),
    status: 'ready',
    updatedAt: '2026-07-17T10:01:00.000Z',
  },
  link: {
    applicationId: 'application-1',
    contentEntryId: 'entry-1',
    createdAt: '2026-07-17T10:00:00.000Z',
    currentRevisionId: 'revision-1',
    disabledAt: null,
    disabledReason: null,
    enabled: true,
    id: 'link-1',
    previewToken: 'preview-token',
    publicationVersion: 1,
    publicUrl: 'https://cv.example.test/c/token',
    token: 'token',
    updatedAt: '2026-07-17T10:00:00.000Z',
    version: 1,
  },
} as const satisfies CvPageState

const publishedRun = (link: CvLink): CvPublicationRun => ({
  _tag: 'Published',
  applicationId: link.applicationId,
  entryId: link.contentEntryId,
  executionId: 'execution-1',
  message: 'Published.',
  result: {
    applicationId: link.applicationId,
    entryId: link.contentEntryId,
    link,
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

describe('resolveCurrentCvPage', () => {
  test('prefers a newer durable availability state over a terminal Workflow run', () => {
    const queried = { ...publication, link: disabledLink(2) }

    const resolved = resolveCurrentCvPage({
      availabilityLink: null,
      publicationRun: publishedRun(publication.link),
      queriedPage: queried,
    })

    expect(resolved).toBe(queried)
    expect(resolved?.link.enabled).toBe(false)
  })

  test('folds the latest availability mutation into the page read model', () => {
    const queried = { ...publication, link: disabledLink(2) }
    const enabledLink: CvLink = {
      ...publication.link,
      updatedAt: '2026-07-17T12:00:00.000Z',
      version: 3,
    }

    const resolved = resolveCurrentCvPage({
      availabilityLink: enabledLink,
      publicationRun: publishedRun(publication.link),
      queriedPage: queried,
    })

    expect(resolved?.link).toBe(enabledLink)
    expect(resolved?.artifact).toBe(publication.artifact)
  })

  test('uses a newer Workflow link while its invalidated query catches up', () => {
    const nextLink: CvLink = {
      ...publication.link,
      currentRevisionId: 'revision-2',
      publicationVersion: 2,
      version: 2,
    }

    const resolved = resolveCurrentCvPage({
      availabilityLink: null,
      publicationRun: publishedRun(nextLink),
      queriedPage: publication,
    })

    expect(resolved?.link).toBe(nextLink)
    expect(resolved?.artifact).toBeNull()
  })

  test('rejects a stale artifact for shareability and publication commands', () => {
    const staleArtifact: CvPageState = {
      artifact: {
        ...publication.artifact,
        publicationVersion: publication.link.publicationVersion - 1,
      },
      link: publication.link,
    }

    expect(currentCvPdfArtifact(staleArtifact)).toBeNull()
    expect(cvPublicationHasReadyPdf(staleArtifact)).toBe(false)
    expect(cvPublicationIsShareable(staleArtifact)).toBe(false)
    expect(cvPublicationCanGeneratePdf(staleArtifact)).toBe(true)
  })

  test('allows manual PDF generation only while the page is enabled', () => {
    const disabled: CvPageState = {
      ...publication,
      link: disabledLink(2),
    }

    expect(cvPublicationHasReadyPdf(disabled)).toBe(true)
    expect(cvPublicationIsShareable(disabled)).toBe(false)
    expect(cvPublicationCanGeneratePdf(disabled)).toBe(false)
  })
})
