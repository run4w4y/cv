import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import type { NewWorkflowScreenProps } from './new-workflow-screen'
import { NewWorkflowScreen } from './new-workflow-screen'

afterEach(cleanup)

const baseProps: NewWorkflowScreenProps = {
  canStart: false,
  existingApplication: null,
  executionEnvironment: null,
  form: {
    includeCoverLetter: true,
    locale: 'en',
    postingUrls: 'https://jobs.example.test/staff-engineer',
    prompt: 'Write a concise letter.',
  },
  guidancePanel: null,
  guidanceReady: true,
  localeError: null,
  locales: ['en'],
  onFormChange: mock(() => undefined),
  onStart: mock(() => undefined),
  onStepChange: mock(() => undefined),
  promptCharactersRemaining: 19_000,
  rows: [],
  startError: null,
  starting: false,
  step: 1,
  targetContextReady: true,
  targetUrls: ['https://jobs.example.test/staff-engineer'],
  targetsValid: true,
  tooLarge: false,
}

const renderScreen = (props: NewWorkflowScreenProps) =>
  render(
    <MemoryRouter>
      <NewWorkflowScreen {...props} />
    </MemoryRouter>
  )

describe('NewWorkflowScreen', () => {
  test('authors PostingUrl targets for a new workflow', () => {
    const view = renderScreen(baseProps)

    expect(view.getByLabelText('Job posting URLs')).toBeTruthy()
    expect(view.getByText('1 unique target')).toBeTruthy()
  })

  test('uses the same flow for a pinned existing application target', () => {
    const view = renderScreen({
      ...baseProps,
      existingApplication: {
        applicationId: 'application-1',
        company: 'Example',
        contextMessage: 'Reviewed application context is pinned and ready.',
        contextStatus: 'ready',
        postingUrl: 'https://jobs.example.test/staff-engineer',
        role: 'Staff Engineer',
      },
      targetUrls: ['https://jobs.example.test/staff-engineer'],
    })

    expect(view.queryByLabelText('Job posting URLs')).toBeNull()
    expect(view.getByText('Existing application')).toBeTruthy()
    expect(view.getByRole('heading', { name: 'Example' })).toBeTruthy()
    expect(
      view.getAllByText('Reviewed application context is pinned and ready.')
    ).toHaveLength(2)
  })
})
