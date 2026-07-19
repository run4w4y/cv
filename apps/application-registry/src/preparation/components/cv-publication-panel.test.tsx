import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'

import type { CvPageState } from '../data'
import { CvPublicationPanel } from './cv-publication-panel'

const publication = {
  artifact: {
    byteLength: 1_024,
    contentRevisionId: 'revision-current',
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
    requestId: 'request-1',
    sha256: 'a'.repeat(64),
    status: 'ready',
    updatedAt: '2026-07-17T10:01:00.000Z',
  },
  link: {
    applicationId: 'application-1',
    contentEntryId: 'entry-1',
    createdAt: '2026-07-17T10:00:00.000Z',
    currentRevisionId: 'revision-current',
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

afterEach(cleanup)

describe('CvPublicationPanel', () => {
  test('represents page visibility and PDF readiness as independent controls', () => {
    const onDownload = mock(() => undefined)
    const onGeneratePdf = mock(() => undefined)
    const onSetAvailability = mock((_enabled: boolean) => undefined)
    const view = render(
      <CvPublicationPanel
        currentHeadRevisionId="revision-new-draft"
        disabled={false}
        publication={publication}
        pendingAction={null}
        onDownload={onDownload}
        onGeneratePdf={onGeneratePdf}
        onRefresh={() => undefined}
        onSetAvailability={onSetAvailability}
      />
    )

    expect(view.getByText('Page is public')).toBeTruthy()
    expect(view.getByText('PDF ready')).toBeTruthy()
    expect(view.getByText('Preview uses an earlier revision')).toBeTruthy()
    expect(
      view.getByRole('link', { name: /Open published CV/ }).getAttribute('href')
    ).toBe(publication.link.publicUrl)

    fireEvent.click(view.getByRole('button', { name: 'Download PDF' }))
    fireEvent.click(view.getByRole('button', { name: 'Regenerate PDF' }))
    fireEvent.click(view.getByRole('button', { name: 'Make page private' }))

    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(onGeneratePdf).toHaveBeenCalledTimes(1)
    expect(onSetAvailability).toHaveBeenCalledWith(false)
  })

  test('keeps a private page previewable when its PDF generation failed', () => {
    const onGeneratePdf = mock(() => undefined)
    const onSetAvailability = mock((_enabled: boolean) => undefined)
    const failed: CvPageState = {
      artifact: {
        ...publication.artifact,
        byteLength: null,
        errorCode: 'cv_page_overflow',
        errorMessage: 'The CV exceeds one A4 page.',
        generatedAt: null,
        mediaType: null,
        objectKey: null,
        sha256: null,
        status: 'failed',
      },
      link: {
        ...publication.link,
        disabledAt: '2026-07-17T11:00:00.000Z',
        disabledReason: 'draft_revision',
        enabled: false,
        version: 2,
      },
    }
    const view = render(
      <CvPublicationPanel
        currentHeadRevisionId="revision-current"
        disabled={false}
        publication={failed}
        pendingAction={null}
        onDownload={() => undefined}
        onGeneratePdf={onGeneratePdf}
        onRefresh={() => undefined}
        onSetAvailability={onSetAvailability}
      />
    )

    expect(view.getByText('Private draft')).toBeTruthy()
    expect(view.getByText('PDF generation failed')).toBeTruthy()
    expect(view.getByText('The CV exceeds one A4 page.')).toBeTruthy()
    expect(view.queryByRole('link', { name: /Open published CV/ })).toBeNull()
    expect(
      (view.getByRole('button', { name: 'Download PDF' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)

    fireEvent.click(view.getByRole('button', { name: 'Regenerate PDF' }))
    fireEvent.click(view.getByRole('button', { name: 'Make page public' }))
    expect(onGeneratePdf).toHaveBeenCalledTimes(1)
    expect(onSetAvailability).toHaveBeenCalledWith(true)
  })
})
