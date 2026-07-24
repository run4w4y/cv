import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ApplicationArtifact } from '@cv/application-registry-entity'
import { cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

import { renderWithRegistry } from '../../../test/render-with-registry'
import { ApplicationArtifactPage } from './render'

const originalFetch = globalThis.fetch
const originalCreateObjectUrl = URL.createObjectURL
const originalRevokeObjectUrl = URL.revokeObjectURL

const artifact: ApplicationArtifact = {
  applicationId: 'application-1',
  byteLength: 4,
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
}

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: originalCreateObjectUrl,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: originalRevokeObjectUrl,
  })
})

const renderArtifactPage = () =>
  renderWithRegistry(
    <MemoryRouter
      initialEntries={['/applications/application-1/artifacts/artifact-1']}
    >
      <Routes>
        <Route
          path="/applications/:applicationId/artifacts/:artifactId"
          element={<ApplicationArtifactPage />}
        />
      </Routes>
    </MemoryRouter>
  )

describe('ApplicationArtifactPage', () => {
  test('loads PDF metadata and content in parallel and revokes its preview URL', async () => {
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      requests.push(url)
      return url.endsWith('/content')
        ? new Response(new Uint8Array([37, 80, 68, 70]), {
            headers: { 'content-type': 'application/octet-stream' },
          })
        : Response.json(artifact)
    }) as unknown as typeof fetch
    const createObjectUrl = mock(() => 'blob:artifact-preview')
    const revokeObjectUrl = mock(() => undefined)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    })
    const view = renderArtifactPage()

    const preview = (await view.findByTitle(
      'resume-en.pdf preview'
    )) as HTMLIFrameElement
    expect(preview.getAttribute('src')).toBe('blob:artifact-preview')
    expect(requests).toContain(
      'http://localhost/api/registry/applications/application-1/artifacts/artifact-1'
    )
    expect(requests).toContain(
      'http://localhost/api/registry/applications/application-1/artifacts/artifact-1/content'
    )
    expect(createObjectUrl).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:artifact-preview')
  })

  test('offers a download when the file is not a PDF', async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      return url.endsWith('/content')
        ? new Response(new TextEncoder().encode('portfolio'), {
            headers: { 'content-type': 'application/octet-stream' },
          })
        : Response.json({
            ...artifact,
            category: 'supporting_document',
            filename: 'portfolio.txt',
            mediaType: 'text/plain',
          } satisfies ApplicationArtifact)
    }) as unknown as typeof fetch
    const createObjectUrl = mock(() => 'blob:should-not-be-created')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    })
    const view = renderArtifactPage()

    expect(await view.findByText('Preview unavailable')).toBeTruthy()
    expect(
      view.getByRole('button', { name: 'Download portfolio.txt' })
    ).toBeTruthy()
    expect(createObjectUrl).not.toHaveBeenCalled()
  })
})
