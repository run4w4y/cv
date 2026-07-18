import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'

import type { PublishedCvState } from '../api'
import { CvPublicationPanel } from './cv-publication-panel'

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

afterEach(cleanup)

describe('CvPublicationPanel', () => {
  test('keeps an earlier live revision visible and exposes disable/download controls', () => {
    const onDownload = mock(() => undefined)
    const onSetAvailability = mock((_enabled: boolean) => undefined)
    const view = render(
      <CvPublicationPanel
        currentHeadRevisionId="revision-new-draft"
        disabled={false}
        publication={publication}
        pendingAction={null}
        onDownload={onDownload}
        onSetAvailability={onSetAvailability}
      />
    )

    expect(view.getByText('Earlier revision remains published')).toBeTruthy()
    expect(
      view.getByRole('link', { name: /Open published CV/ }).getAttribute('href')
    ).toBe(publication.link.publicUrl)

    fireEvent.click(view.getByRole('button', { name: 'Download PDF' }))
    fireEvent.click(view.getByRole('button', { name: 'Disable public link' }))

    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(onSetAvailability).toHaveBeenCalledWith(false)
  })

  test('preserves PDF access and offers re-enable for a disabled link', () => {
    const onSetAvailability = mock((_enabled: boolean) => undefined)
    const disabledPublication: PublishedCvState = {
      ...publication,
      link: {
        ...publication.link,
        disabledAt: '2026-07-17T11:00:00.000Z',
        disabledReason: 'Disabled manually from CV preparation.',
        enabled: false,
        version: 2,
      },
    }
    const view = render(
      <CvPublicationPanel
        currentHeadRevisionId="revision-published"
        disabled={false}
        publication={disabledPublication}
        pendingAction={null}
        onDownload={() => undefined}
        onSetAvailability={onSetAvailability}
      />
    )

    expect(view.queryByRole('link', { name: /Open published CV/ })).toBeNull()
    expect(view.getByRole('button', { name: 'Download PDF' })).toBeTruthy()
    expect(
      view.getByText('Disabled manually from CV preparation.')
    ).toBeTruthy()

    fireEvent.click(view.getByRole('button', { name: 'Enable public link' }))
    expect(onSetAvailability).toHaveBeenCalledWith(true)
  })

  test('blocks publication mutations while another preparation action is pending', () => {
    const onDownload = mock(() => undefined)
    const onSetAvailability = mock((_enabled: boolean) => undefined)
    const view = render(
      <CvPublicationPanel
        currentHeadRevisionId="revision-published"
        disabled
        publication={publication}
        pendingAction={null}
        onDownload={onDownload}
        onSetAvailability={onSetAvailability}
      />
    )

    fireEvent.click(view.getByRole('button', { name: 'Download PDF' }))
    fireEvent.click(view.getByRole('button', { name: 'Disable public link' }))

    expect(onDownload).not.toHaveBeenCalled()
    expect(onSetAvailability).not.toHaveBeenCalled()
  })
})
