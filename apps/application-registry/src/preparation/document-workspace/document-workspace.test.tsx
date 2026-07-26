import { afterEach, describe, expect, mock, test } from 'bun:test'
import { TooltipProvider } from '@cv/internal-ui'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import * as React from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { HeaderActionsProvider } from '@/shell/header-actions'

import { DocumentWorkspace } from './document-workspace'
import type { DocumentWorkspaceMode } from './types'

afterEach(cleanup)

const WorkspaceHarness = ({
  disabled,
  onSend,
}: {
  readonly disabled: boolean
  readonly onSend: (prompt: string) => void
}) => {
  const [mode, setMode] = React.useState<DocumentWorkspaceMode>('edit')
  const [composer, setComposer] = React.useState('')
  const [headerTarget, setHeaderTarget] = React.useState<HTMLDivElement | null>(
    null
  )

  return (
    <>
      <div data-testid="app-header-actions" ref={setHeaderTarget} />
      <HeaderActionsProvider target={headerTarget}>
        <TooltipProvider delay={0}>
          <DocumentWorkspace
            assistant={{
              available: true,
              composer,
              messages: [],
              onComposerChange: setComposer,
              onSubmitComposer: () => {
                onSend(composer)
                setComposer('')
              },
              pending: false,
            }}
            canRedo={false}
            canUndo
            changes={[
              {
                after: 'Platform engineer',
                before: 'Software engineer',
                kind: 'changed',
                path: ['person', 'headline'],
              },
            ]}
            dirty
            disabled={disabled}
            mode={mode}
            onModeChange={setMode}
            onRedo={() => undefined}
            onUndo={() => undefined}
            postingHref="https://jobs.example.test/platform"
            preview={<div>Preview canvas</div>}
            primaryAction={{
              kind: 'save',
              label: 'Save draft',
              onAction: () => undefined,
            }}
            title="Review CV"
            validationIssues={[]}
          >
            <div>Editor canvas</div>
          </DocumentWorkspace>
        </TooltipProvider>
      </HeaderActionsProvider>
    </>
  )
}

const renderWorkspace = (
  onSend: (prompt: string) => void = () => undefined,
  disabled = false
) => {
  const router = createMemoryRouter(
    [
      {
        path: '/document',
        element: <WorkspaceHarness disabled={disabled} onSend={onSend} />,
      },
      {
        path: '/other',
        element: <div>Other route</div>,
      },
    ],
    { initialEntries: ['/document'] }
  )
  const view = render(<RouterProvider router={router} />)
  return { ...view, router }
}

describe('DocumentWorkspace', () => {
  test('switches the central canvas from the right rail', () => {
    const view = renderWorkspace()
    expect(view.getByText('Editor canvas')).toBeTruthy()

    fireEvent.click(view.getByRole('button', { name: 'Preview' }))
    expect(view.queryByText('Editor canvas')).toBeNull()
    expect(view.getByText('Preview canvas')).toBeTruthy()

    fireEvent.click(view.getByRole('button', { name: /Changes/ }))
    expect(view.getByText('Profile · Headline')).toBeTruthy()
    expect(view.getByText('Software engineer')).toBeTruthy()
    expect(view.getByText('Platform engineer')).toBeTruthy()
  })

  test('puts document commands in the app header', async () => {
    const view = renderWorkspace()

    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Save draft' })).toBeTruthy()
    )
    expect(view.getByRole('button', { name: 'Undo' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'Open posting' })).toHaveProperty(
      'href',
      'https://jobs.example.test/platform'
    )
  })

  test('keeps the assistant composer at the workspace boundary', () => {
    const onSend = mock(() => undefined)
    const view = renderWorkspace(onSend)

    fireEvent.change(view.getByLabelText('Message Codex'), {
      target: { value: 'Tighten the opening.' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Send message' }))

    expect(onSend).toHaveBeenCalledWith('Tighten the opening.')
    expect(view.getByLabelText('Message Codex')).toHaveProperty('value', '')
  })

  test('locks Codex interactions while the document is read-only', () => {
    const onSend = mock(() => undefined)
    const view = renderWorkspace(onSend, true)

    expect(view.getByLabelText('Message Codex')).toHaveProperty(
      'disabled',
      true
    )
    expect(view.getByText('Document is read-only')).toBeTruthy()
    expect(onSend).not.toHaveBeenCalled()
  })

  test('protects dirty drafts from route and window navigation', async () => {
    const previousConfirm = globalThis.confirm
    const confirmDiscard = mock(() => false)
    globalThis.confirm = confirmDiscard

    try {
      const view = renderWorkspace()
      const unload = new Event('beforeunload', { cancelable: true })
      globalThis.dispatchEvent(unload)
      expect(unload.defaultPrevented).toBe(true)

      void view.router.navigate('/other')
      await waitFor(() => expect(confirmDiscard).toHaveBeenCalledTimes(1))
      expect(view.router.state.location.pathname).toBe('/document')
    } finally {
      globalThis.confirm = previousConfirm
    }
  })
})
