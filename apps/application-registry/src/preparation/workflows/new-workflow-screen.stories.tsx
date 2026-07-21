import { maximumCoverLetterPromptLength } from '@cv/application-preparation-workflow/domain'
import { Badge } from '@cv/internal-ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CheckCircle2, TerminalSquare } from 'lucide-react'
import * as React from 'react'

import type { BatchPreparationForm } from '@/preparation/batch/atoms'
import { NewWorkflowScreen } from './new-workflow-screen'
import {
  invalidWorkflowForm,
  storyWorkflowUrlRows,
  validWorkflowForm,
} from './story-fixtures'

type NewWorkflowPreviewProps = {
  readonly guidanceReady: boolean
  readonly initialForm: BatchPreparationForm
  readonly initialStarting: boolean
  readonly initialStep: 1 | 2 | 3
  readonly locales: ReadonlyArray<string>
  readonly startError: string | null
}

const StoryExecutionEnvironment = () => (
  <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
    <div className="flex gap-3">
      <TerminalSquare className="mt-0.5 size-4 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">Local Codex runtime</p>
        <p className="mt-1 text-xs/5 text-muted-foreground">
          Three workflow jobs and two Codex calls may execute concurrently.
        </p>
      </div>
    </div>
    <Badge variant="success">
      <CheckCircle2 />
      Ready
    </Badge>
  </div>
)

const StoryGuidancePanel = ({ ready }: { readonly ready: boolean }) => (
  <div className="grid gap-3 text-sm">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={ready ? 'success' : 'danger'}>
        {ready ? 'Schema-valid' : 'Unavailable'}
      </Badge>
      <span className="font-mono text-xs text-muted-foreground">
        facts-2026-07-18 · en
      </span>
    </div>
    <p className="text-muted-foreground">
      Prioritize role-relevant outcomes, preserve verified claims, and keep the
      generated candidate within the active CV schema.
    </p>
  </div>
)

const NewWorkflowPreview = ({
  guidanceReady,
  initialForm,
  initialStarting,
  initialStep,
  locales,
  startError,
}: NewWorkflowPreviewProps) => {
  const [form, setForm] = React.useState(initialForm)
  const [starting, setStarting] = React.useState(initialStarting)
  const [step, setStep] = React.useState(initialStep)
  const rows = storyWorkflowUrlRows(form.urls)
  const uniqueUrls = rows.flatMap((row) =>
    row.canonicalUrl !== null && row.duplicateOf === null
      ? [row.canonicalUrl]
      : []
  )
  const tooLarge = uniqueUrls.length > 25
  const urlsValid =
    uniqueUrls.length > 0 &&
    !tooLarge &&
    rows.every((row) => row.canonicalUrl !== null)
  const localeError =
    form.locale.length > 0 && !locales.includes(form.locale)
      ? 'Select a locale published by the active facts release.'
      : null
  const promptCharactersRemaining =
    maximumCoverLetterPromptLength - form.prompt.length
  const settingsValid =
    form.locale.length > 0 &&
    localeError === null &&
    (form.kind === 'cv' || form.prompt.trim().length > 0) &&
    promptCharactersRemaining >= 0
  const canStart =
    urlsValid && settingsValid && (form.kind !== 'cv' || guidanceReady)

  return (
    <NewWorkflowScreen
      canStart={canStart}
      executionEnvironment={<StoryExecutionEnvironment />}
      form={form}
      guidancePanel={<StoryGuidancePanel ready={guidanceReady} />}
      guidanceReady={guidanceReady}
      localeError={localeError}
      locales={locales}
      onFormChange={setForm}
      onStart={() => setStarting(true)}
      onStepChange={setStep}
      promptCharactersRemaining={promptCharactersRemaining}
      rows={rows}
      startError={startError}
      starting={starting}
      step={step}
      tooLarge={tooLarge}
      uniqueUrls={uniqueUrls}
      urlsValid={urlsValid}
    />
  )
}

const meta = {
  title: 'Application Registry/URL workflows/New workflow',
  component: NewWorkflowPreview,
  tags: ['autodocs'],
  parameters: {
    controls: { exclude: ['initialForm'] },
    layout: 'fullscreen',
  },
  args: {
    guidanceReady: true,
    initialForm: validWorkflowForm,
    initialStarting: false,
    initialStep: 1,
    locales: ['en', 'de', 'ru'],
    startError: null,
  },
} satisfies Meta<typeof NewWorkflowPreview>

export default meta
type Story = StoryObj<typeof meta>

/** Interactive URL entry backed only by local story state. */
export const JobUrls: Story = {}

export const InvalidUrls: Story = {
  args: { initialForm: invalidWorkflowForm },
}

export const DocumentSettings: Story = {
  args: { initialStep: 2 },
}

export const CoverLetterSettings: Story = {
  args: {
    initialForm: {
      ...validWorkflowForm,
      kind: 'cover_letter',
      locale: 'de',
      prompt:
        'Write in German. Keep the letter direct and under 350 words, emphasizing platform leadership and mentoring.',
    },
    initialStep: 2,
  },
}

export const ConfirmAndLaunch: Story = {
  args: { initialStep: 3 },
}

export const StartingBatch: Story = {
  args: { initialStarting: true, initialStep: 3 },
}

export const StartFailed: Story = {
  args: {
    initialStep: 3,
    startError:
      'The local workflow runtime rejected the batch before any jobs were created.',
  },
}

export const NoPublishedLocales: Story = {
  args: {
    initialForm: { ...validWorkflowForm, locale: '' },
    initialStep: 2,
    locales: [],
  },
}
