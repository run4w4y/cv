import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ApplicationArtifact } from '@cv/application-registry-entity'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import { renderWithRegistry } from '../../../test/render-with-registry'
import { ApplicationArtifactsCard } from './render'

const artifacts: readonly ApplicationArtifact[] = [
  {
    applicationId: 'application-1',
    byteLength: 2048,
    category: 'resume',
    contentRevisionId: 'revision-1',
    createdAt: '2026-07-24T09:00:00.000Z',
    filename: 'resume-en.pdf',
    generatedArtifactId: 'generated-1',
    id: 'artifact-1',
    locale: 'en',
    mediaType: 'application/pdf',
    objectKey: `sha256/${'a'.repeat(64)}`,
    sha256: 'a'.repeat(64),
    source: 'generated',
  },
  {
    applicationId: 'application-1',
    byteLength: 512,
    category: 'supporting_document',
    contentRevisionId: null,
    createdAt: '2026-07-24T10:00:00.000Z',
    filename: 'portfolio.txt',
    generatedArtifactId: null,
    id: 'artifact-2',
    locale: null,
    mediaType: 'text/plain',
    objectKey: `sha256/${'b'.repeat(64)}`,
    sha256: 'b'.repeat(64),
    source: 'uploaded',
  },
]

const originalCreateObjectUrl = URL.createObjectURL
const originalRevokeObjectUrl = URL.revokeObjectURL
const originalAnchorClick = HTMLAnchorElement.prototype.click

afterEach(() => {
  cleanup()
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: originalCreateObjectUrl,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: originalRevokeObjectUrl,
  })
  HTMLAnchorElement.prototype.click = originalAnchorClick
})

describe('ApplicationArtifactsCard', () => {
  test('shows the empty state when an application has no artifacts', () => {
    const view = renderWithRegistry(
      <MemoryRouter>
        <ApplicationArtifactsCard
          applicationId="application-1"
          artifacts={[]}
        />
      </MemoryRouter>
    )

    expect(view.getByText('No artifacts yet')).toBeTruthy()
    expect(view.getByRole('button', { name: 'Upload artifact' })).toBeTruthy()
  })

  test('lists multiple artifacts with same-window view links', () => {
    const view = renderWithRegistry(
      <MemoryRouter>
        <ApplicationArtifactsCard
          applicationId="application-1"
          artifacts={artifacts}
        />
      </MemoryRouter>
    )

    expect(view.getByText('resume-en.pdf')).toBeTruthy()
    expect(view.getByText('portfolio.txt')).toBeTruthy()
    expect(
      view.getByText('resume-en.pdf').parentElement?.textContent
    ).toContain('2 KB')
    const links = view.getAllByRole('link', { name: 'View' })
    expect(links[0]?.getAttribute('href')).toBe(
      '/applications/application-1/artifacts/artifact-1'
    )
    expect(links[1]?.getAttribute('href')).toBe(
      '/applications/application-1/artifacts/artifact-2'
    )
  })

  test('refreshes artifacts that may have been generated elsewhere', async () => {
    const refreshArtifacts = mock(async () => undefined)
    const view = renderWithRegistry(
      <MemoryRouter>
        <ApplicationArtifactsCard
          applicationId="application-1"
          artifacts={artifacts}
          refreshArtifacts={refreshArtifacts}
        />
      </MemoryRouter>
    )

    fireEvent.click(view.getByRole('button', { name: 'Refresh' }))
    await waitFor(() =>
      expect(refreshArtifacts).toHaveBeenCalledWith('application-1')
    )
  })

  test('downloads the selected artifact content', async () => {
    const readArtifactContent = mock(async () => new Uint8Array([1, 2, 3]))
    const createObjectUrl = mock(() => 'blob:download')
    const anchorClick = mock(() => undefined)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: mock(() => undefined),
    })
    HTMLAnchorElement.prototype.click = anchorClick
    const view = renderWithRegistry(
      <MemoryRouter>
        <ApplicationArtifactsCard
          applicationId="application-1"
          artifacts={[artifacts[0] as ApplicationArtifact]}
          readArtifactContent={readArtifactContent}
        />
      </MemoryRouter>
    )

    fireEvent.click(view.getByRole('button', { name: 'Download' }))
    await waitFor(() =>
      expect(readArtifactContent).toHaveBeenCalledWith({
        applicationId: 'application-1',
        artifactId: 'artifact-1',
      })
    )
    expect(createObjectUrl).toHaveBeenCalledTimes(1)
    expect(anchorClick).toHaveBeenCalledTimes(1)
  })
})
