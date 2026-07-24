import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'

import { renderWithRegistry } from '../../../test/render-with-registry'
import type { UploadApplicationArtifactInput } from '../../data'
import { UploadApplicationArtifactDialog } from './upload-dialog'

afterEach(cleanup)

describe('UploadApplicationArtifactDialog', () => {
  test('keeps one operation id for retries and changes it after an edit', async () => {
    const attempts: UploadApplicationArtifactInput[] = []
    const uploadArtifact = mock(
      async (input: UploadApplicationArtifactInput) => {
        attempts.push(input)
        if (attempts.length < 3) throw new Error('Temporary upload failure.')
      }
    )
    const file = new File(['resume'], 'resume.pdf', {
      lastModified: 123,
      type: 'application/pdf',
    })
    const view = renderWithRegistry(
      <UploadApplicationArtifactDialog
        applicationId="application-1"
        uploadArtifact={uploadArtifact}
      />
    )

    fireEvent.click(view.getByRole('button', { name: 'Upload artifact' }))
    const fileInput = view.getByLabelText('File')
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    })
    fireEvent.change(fileInput)
    fireEvent.click(view.getByRole('button', { name: 'Upload artifact' }))
    await view.findByText('Temporary upload failure.')

    fireEvent.click(view.getByRole('button', { name: 'Upload artifact' }))
    await waitFor(() => expect(attempts).toHaveLength(2))
    expect(attempts[1]?.operationId).toBe(attempts[0]?.operationId)

    fireEvent.change(view.getByLabelText('Locale (optional)'), {
      target: { value: 'en-US' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Upload artifact' }))
    await waitFor(() => expect(attempts).toHaveLength(3))

    expect(attempts[2]?.operationId).not.toBe(attempts[1]?.operationId)
    expect(attempts[2]?.locale).toBe('en-US')
    expect(attempts[2]?.category).toBe('resume')
    expect(attempts[2]?.filename).toBe('resume.pdf')
    await waitFor(() =>
      expect(
        view.queryByRole('heading', {
          name: 'Upload application artifact',
        })
      ).toBeNull()
    )
  })
})
