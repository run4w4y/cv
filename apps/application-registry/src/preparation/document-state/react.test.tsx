import { afterEach, describe, expect, test } from 'bun:test'
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react'
import * as Result from 'effect/Result'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as React from 'react'

import { renderWithRegistry } from '../../test/render-with-registry'
import {
  DocumentStudioProvider,
  type DocumentStudioScopeInput,
  useDocumentStudioAtoms,
} from './react'
import { initialCoverLetterDocument } from './session'

afterEach(cleanup)

const firstInput: DocumentStudioScopeInput = {
  authoritativeKey: 'job-1:cover-letter:revision-1',
  document: {
    ...initialCoverLetterDocument('en', 'cv-revision-1'),
    body: 'First cover letter.',
  },
  identity: {
    applicationId: 'application-1',
    kind: 'cover_letter',
    locale: 'en',
    referenceCvRevisionId: 'cv-revision-1',
  },
}

const secondInput: DocumentStudioScopeInput = {
  authoritativeKey: 'job-2:cover-letter:revision-2',
  document: {
    ...initialCoverLetterDocument('en', 'cv-revision-2'),
    body: 'Second cover letter.',
  },
  identity: {
    applicationId: 'application-2',
    kind: 'cover_letter',
    locale: 'en',
    referenceCvRevisionId: 'cv-revision-2',
  },
}

const Probe = () => {
  const studio = useDocumentStudioAtoms()
  const state = useAtomValue(studio)
  const body = useAtomValue(studio.valueAt(['body']))
  const edit = useAtomSet(studio.edit)
  const [mode, setMode] = useAtom(studio.mode)

  if (!AsyncResult.isSuccess(state) || !AsyncResult.isSuccess(body)) {
    return <output>pending</output>
  }

  return (
    <section>
      <output data-testid="application">
        {state.value.document.locale}:{studio.kind}:{studio.key}
      </output>
      <output data-testid="body">
        {Result.isSuccess(body.value) ? String(body.value.success) : 'missing'}
      </output>
      <output data-testid="mode">{mode}</output>
      <button
        type="button"
        onClick={() =>
          edit({ path: ['body'], value: 'Edited in the scoped atom.' })
        }
      >
        Edit
      </button>
      <button type="button" onClick={() => setMode('preview')}>
        Preview
      </button>
    </section>
  )
}

const Studio = ({ input }: { readonly input: DocumentStudioScopeInput }) => (
  <DocumentStudioProvider value={input}>
    <Probe />
  </DocumentStudioProvider>
)

describe('DocumentStudioProvider', () => {
  test('owns draft actions and UI mode without component-local state', async () => {
    const view = renderWithRegistry(
      <React.StrictMode>
        <Studio input={firstInput} />
      </React.StrictMode>
    )

    await waitFor(() =>
      expect(view.getByTestId('body').textContent).toBe('First cover letter.')
    )

    act(() => {
      fireEvent.click(view.getByText('Edit'))
      fireEvent.click(view.getByText('Preview'))
    })

    await waitFor(() =>
      expect(view.getByTestId('body').textContent).toBe(
        'Edited in the scoped atom.'
      )
    )
    expect(view.getByTestId('mode').textContent).toBe('preview')
  })

  test('remounts a clean scoped resource when the authoritative key changes', async () => {
    const view = renderWithRegistry(<Studio input={firstInput} />)

    await waitFor(() =>
      expect(view.getByTestId('body').textContent).toBe('First cover letter.')
    )
    fireEvent.click(view.getByText('Edit'))
    await waitFor(() =>
      expect(view.getByTestId('body').textContent).toBe(
        'Edited in the scoped atom.'
      )
    )

    view.rerender(<Studio input={secondInput} />)

    await waitFor(() =>
      expect(view.getByTestId('body').textContent).toBe('Second cover letter.')
    )
    expect(view.getByTestId('mode').textContent).toBe('edit')
    expect(view.getByTestId('application').textContent).toContain(
      'application-2'
    )
  })
})
