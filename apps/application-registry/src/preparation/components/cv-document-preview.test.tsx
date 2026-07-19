import { afterEach, describe, expect, test } from 'bun:test'
import type { CvLink } from '@cv/application-registry-entity'
import { cleanup, render } from '@testing-library/react'

import { CvDocumentPreview } from './cv-document-preview'

const link: CvLink = {
  applicationId: 'application-1',
  contentEntryId: 'entry-1',
  createdAt: '2026-07-19T10:00:00.000Z',
  currentRevisionId: 'revision-1',
  disabledAt: '2026-07-19T10:00:00.000Z',
  disabledReason: 'draft_revision',
  enabled: false,
  id: 'link-1',
  previewToken: 'preview-secret',
  publicationVersion: 1,
  publicUrl: 'https://cv.example.test/c/public-token',
  token: 'public-token',
  updatedAt: '2026-07-19T10:00:00.000Z',
  version: 1,
}

afterEach(cleanup)

describe('CvDocumentPreview', () => {
  test('renders the persisted page through its protected preview URL', () => {
    const view = render(<CvDocumentPreview link={link} />)
    const frame = view.getByTitle('Private CV preview') as HTMLIFrameElement

    expect(frame.src).toBe(
      'https://cv.example.test/c/_preview/public-token?access=preview-secret'
    )
    expect(frame.referrerPolicy).toBe('no-referrer')
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
  })
})
