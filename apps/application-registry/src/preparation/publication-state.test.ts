import { describe, expect, test } from 'bun:test'

import type { PublishedCvState } from './api'
import {
  initialCvPublicationViewState,
  reduceCvPublicationViewState,
} from './publication-state'

const publication = {
  artifact: {
    byteLength: 1_024,
    contentRevisionId: 'revision-published',
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
    workflowId: 'workflow-1',
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
    publishedRevisionId: 'revision-published',
    token: 'token',
    updatedAt: '2026-07-17T10:00:00.000Z',
    version: 1,
  },
} as const satisfies PublishedCvState

describe('CV publication view state', () => {
  test('keeps the live publication while the same entry gets a newer editor head', () => {
    const selected = reduceCvPublicationViewState(
      initialCvPublicationViewState,
      { type: 'select-entry', entryId: 'entry-1' }
    )
    const loaded = reduceCvPublicationViewState(selected, {
      type: 'publication-loaded',
      entryId: 'entry-1',
      publication,
    })

    const sameEntry = reduceCvPublicationViewState(loaded, {
      type: 'select-entry',
      entryId: 'entry-1',
    })

    expect(sameEntry).toBe(loaded)
    expect(sameEntry.publication).toBe(publication)
  })

  test('clears on another entry and ignores a late response for the old one', () => {
    const loaded = reduceCvPublicationViewState(
      { entryId: 'entry-1', publication: null },
      {
        type: 'publication-loaded',
        entryId: 'entry-1',
        publication,
      }
    )
    const moved = reduceCvPublicationViewState(loaded, {
      type: 'select-entry',
      entryId: 'entry-2',
    })

    expect(moved.publication).toBeNull()
    expect(
      reduceCvPublicationViewState(moved, {
        type: 'publication-loaded',
        entryId: 'entry-1',
        publication,
      })
    ).toBe(moved)
  })

  test('updates availability without replacing the preserved PDF artifact', () => {
    const state = { entryId: 'entry-1', publication }
    const disabledLink = {
      ...publication.link,
      disabledAt: '2026-07-17T11:00:00.000Z',
      disabledReason: 'Disabled manually from CV preparation.',
      enabled: false,
      version: 2,
    }

    const updated = reduceCvPublicationViewState(state, {
      type: 'link-updated',
      link: disabledLink,
    })

    expect(updated.publication?.link).toEqual(disabledLink)
    expect(updated.publication?.artifact).toBe(publication.artifact)
  })
})
