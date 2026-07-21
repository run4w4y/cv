import {
  type DocumentKind,
  maximumPreparationBatchSize,
} from '@cv/application-preparation-workflow/domain'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  cn,
  Field,
  FieldDescription,
  FieldLabel,
  RadioGroup,
  RadioGroupItem,
  Select,
  Spinner,
  Stepper,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
  Textarea,
} from '@cv/internal-ui'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  FileText,
  ListChecks,
  ScrollText,
  Settings2,
  Sparkles,
} from 'lucide-react'
import type React from 'react'

import type {
  BatchPreparationForm,
  BatchPreparationUrlRow,
} from '@/preparation/batch/atoms'
import { WorkflowPage, WorkflowPageHeader } from './components'
import { documentKindLabel } from './presentation'

const localeDisplayNames = new Intl.DisplayNames(undefined, {
  type: 'language',
})

const localeLabel = (locale: string): string => {
  try {
    return `${localeDisplayNames.of(new Intl.Locale(locale).language) ?? locale} (${locale})`
  } catch {
    return locale
  }
}

const DocumentChoice = ({
  checked,
  description,
  icon: Icon,
  label,
  value,
}: {
  readonly checked: boolean
  readonly description: string
  readonly icon: typeof FileText
  readonly label: string
  readonly value: DocumentKind
}) => (
  <label
    htmlFor={`workflow-kind-${value}`}
    className={cn(
      'flex cursor-pointer gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50',
      checked && 'border-primary bg-primary/5 ring-2 ring-primary/10'
    )}
  >
    <RadioGroupItem id={`workflow-kind-${value}`} value={value} />
    <span className="grid min-w-0 gap-1">
      <span className="flex items-center gap-2 font-medium">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </span>
      <span className="text-sm/6 text-muted-foreground">{description}</span>
    </span>
  </label>
)

const UrlFeedback = ({
  rows,
}: {
  readonly rows: ReadonlyArray<BatchPreparationUrlRow>
}) => {
  const feedbackRows = rows.filter((row) => row.message !== null)
  if (feedbackRows.length === 0) return null

  return (
    <div className="grid gap-2" aria-live="polite">
      {feedbackRows.map((row) => (
        <div
          key={`${row.line}:${row.value}`}
          className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
            row.canonicalUrl === null
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : 'border-border bg-muted/40 text-muted-foreground'
          )}
        >
          {row.canonicalUrl === null ? (
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <Check className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>
            <strong>Line {row.line}:</strong> {row.message}
          </span>
        </div>
      ))}
    </div>
  )
}

const PreflightRow = ({
  description,
  label,
  ready,
}: {
  readonly description: string
  readonly label: string
  readonly ready: boolean
}) => (
  <div className="flex items-start gap-3 rounded-md border border-border p-3">
    <span
      className={cn(
        'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
        ready
          ? 'bg-emerald-500/10 text-emerald-700'
          : 'bg-destructive/10 text-destructive'
      )}
    >
      {ready ? (
        <Check className="size-3.5" />
      ) : (
        <CircleAlert className="size-3.5" />
      )}
    </span>
    <div className="grid gap-0.5">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs/5 text-muted-foreground">{description}</p>
    </div>
  </div>
)

export type NewWorkflowScreenProps = {
  readonly canStart: boolean
  readonly executionEnvironment: React.ReactNode
  readonly form: BatchPreparationForm
  readonly guidancePanel: React.ReactNode
  readonly guidanceReady: boolean
  readonly localeError: string | null
  readonly locales: ReadonlyArray<string>
  readonly onFormChange: (form: BatchPreparationForm) => void
  readonly onStart: () => void
  readonly onStepChange: (step: 1 | 2 | 3) => void
  readonly promptCharactersRemaining: number
  readonly rows: ReadonlyArray<BatchPreparationUrlRow>
  readonly startError: string | null
  readonly starting: boolean
  readonly step: 1 | 2 | 3
  readonly tooLarge: boolean
  readonly uniqueUrls: ReadonlyArray<string>
  readonly urlsValid: boolean
}

export const NewWorkflowScreen = ({
  canStart,
  executionEnvironment,
  form,
  guidancePanel,
  guidanceReady,
  localeError,
  locales,
  onFormChange,
  onStart,
  onStepChange,
  promptCharactersRemaining,
  rows,
  startError,
  starting,
  step,
  tooLarge,
  uniqueUrls,
  urlsValid,
}: NewWorkflowScreenProps) => {
  const settingsValid =
    form.locale.length > 0 &&
    (form.kind === 'cv' || form.prompt.trim().length > 0) &&
    promptCharactersRemaining >= 0
  const reviewReady =
    urlsValid && settingsValid && (form.kind !== 'cv' || guidanceReady)
  const goTo = (nextStep: number) => {
    if (starting) return
    if (nextStep === 1) onStepChange(1)
    if (nextStep === 2 && urlsValid) onStepChange(2)
    if (nextStep === 3 && reviewReady) onStepChange(3)
  }

  return (
    <WorkflowPage className="max-w-5xl">
      <WorkflowPageHeader
        backTo="/workflows"
        backLabel="All workflows"
        eyebrow="New URL workflow"
        title="Prepare documents from job URLs"
        description="Set up one batch in three deliberate steps. Every URL becomes an independent job after the final confirmation."
      />

      <Stepper
        id="new-workflow"
        value={step}
        onValueChange={goTo}
        className="rounded-xl border border-border bg-card p-4 sm:p-6"
      >
        <StepperList aria-label="New workflow steps">
          <StepperItem
            step={1}
            status={step > 1 ? 'complete' : undefined}
            disabled={starting}
          >
            <StepperTrigger>
              <StepperIndicator />
              <StepperTitle>Job URLs</StepperTitle>
              <StepperDescription className="hidden sm:inline">
                Choose the work
              </StepperDescription>
            </StepperTrigger>
            <StepperSeparator />
          </StepperItem>
          <StepperItem step={2} disabled={starting || !urlsValid}>
            <StepperTrigger>
              <StepperIndicator />
              <StepperTitle>Document</StepperTitle>
              <StepperDescription className="hidden sm:inline">
                Configure output
              </StepperDescription>
            </StepperTrigger>
            <StepperSeparator />
          </StepperItem>
          <StepperItem step={3} disabled={starting || !reviewReady}>
            <StepperTrigger>
              <StepperIndicator />
              <StepperTitle>Confirm</StepperTitle>
              <StepperDescription className="hidden sm:inline">
                Run preflight
              </StepperDescription>
            </StepperTrigger>
          </StepperItem>
        </StepperList>

        <StepperContent step={1}>
          <Card className="border-0 shadow-none">
            <CardHeader className="px-0">
              <CardTitle>Which job postings should we prepare?</CardTitle>
              <CardDescription>
                Enter one absolute HTTP(S) URL per line. Duplicates are shown
                and only launched once; a batch can contain up to{' '}
                {maximumPreparationBatchSize} jobs.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-0">
              <Field>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="workflow-urls">Job URLs</FieldLabel>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {uniqueUrls.length} unique URL
                    {uniqueUrls.length === 1 ? '' : 's'}
                  </span>
                </div>
                <Textarea
                  id="workflow-urls"
                  autoFocus
                  aria-invalid={rows.some((row) => row.canonicalUrl === null)}
                  className="min-h-64 resize-y font-mono text-sm leading-6"
                  placeholder={
                    'https://company.example/jobs/123\nhttps://another.example/careers/staff-engineer'
                  }
                  value={form.urls}
                  onChange={(event) =>
                    onFormChange({ ...form, urls: event.currentTarget.value })
                  }
                />
                <FieldDescription>
                  Fragments are removed during canonicalization. URLs with
                  credentials or non-HTTP protocols are rejected.
                </FieldDescription>
              </Field>
              <UrlFeedback rows={rows} />
              {!tooLarge ? null : (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Batch limit exceeded</AlertTitle>
                  <AlertDescription>
                    Remove {uniqueUrls.length - maximumPreparationBatchSize} URL
                    {uniqueUrls.length - maximumPreparationBatchSize === 1
                      ? ''
                      : 's'}{' '}
                    to continue.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="justify-end px-0 pt-6">
              <Button disabled={!urlsValid} onClick={() => onStepChange(2)}>
                Continue
                <ArrowRight />
              </Button>
            </CardFooter>
          </Card>
        </StepperContent>

        <StepperContent step={2}>
          <div className="grid gap-6">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-0">
                <CardTitle>What should each job produce?</CardTitle>
                <CardDescription>
                  These settings apply to all {uniqueUrls.length} jobs in the
                  batch. They do not change the document schemas.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 px-0">
                <RadioGroup<DocumentKind>
                  aria-label="Document type"
                  className="grid gap-3 md:grid-cols-2"
                  value={form.kind}
                  onValueChange={(kind) => onFormChange({ ...form, kind })}
                >
                  <DocumentChoice
                    checked={form.kind === 'cv'}
                    description="Generate an evidence-backed, schema-valid CV candidate for each role."
                    icon={FileText}
                    label="Tailored CV"
                    value="cv"
                  />
                  <DocumentChoice
                    checked={form.kind === 'cover_letter'}
                    description="Generate a concise letter using the same captured job context and reviewed facts."
                    icon={ScrollText}
                    label="Cover letter"
                    value="cover_letter"
                  />
                </RadioGroup>

                <Field>
                  <FieldLabel id="workflow-locale-label">
                    Facts locale
                  </FieldLabel>
                  <FieldDescription id="workflow-locale-description">
                    Available values come from the active verified facts
                    release. The schema still validates the selected locale at
                    launch.
                  </FieldDescription>
                  <Select
                    className="max-w-sm"
                    value={form.locale || null}
                    options={locales.map((locale) => ({
                      label: localeLabel(locale),
                      value: locale,
                    }))}
                    placeholder="Select a published locale"
                    ariaLabelledBy="workflow-locale-label"
                    ariaDescribedBy="workflow-locale-description"
                    disabled={locales.length === 0}
                    onValueChange={(locale) =>
                      onFormChange({ ...form, locale: locale ?? '' })
                    }
                  />
                  {localeError === null ? null : (
                    <p className="text-xs text-destructive">{localeError}</p>
                  )}
                </Field>

                {form.kind !== 'cover_letter' ? null : (
                  <Field>
                    <div className="flex items-center justify-between gap-3">
                      <FieldLabel htmlFor="workflow-prompt">
                        Writing instructions
                      </FieldLabel>
                      <span
                        className={cn(
                          'text-xs tabular-nums text-muted-foreground',
                          promptCharactersRemaining < 0 && 'text-destructive'
                        )}
                      >
                        {promptCharactersRemaining.toLocaleString()} characters
                        remaining
                      </span>
                    </div>
                    <FieldDescription>
                      Describe tone, emphasis, and length for every letter in
                      this batch.
                    </FieldDescription>
                    <Textarea
                      id="workflow-prompt"
                      className="min-h-36"
                      value={form.prompt}
                      onChange={(event) =>
                        onFormChange({
                          ...form,
                          prompt: event.currentTarget.value,
                        })
                      }
                    />
                  </Field>
                )}

                {form.kind !== 'cv' ? null : (
                  <Collapsible className="rounded-lg border border-border">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left hover:bg-muted/50">
                      <span className="flex items-center gap-3">
                        <Settings2 className="size-4 text-muted-foreground" />
                        <span>
                          <span className="block text-sm font-medium">
                            Advanced CV guidance
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Using reviewed guidance from the active facts
                            release
                          </span>
                        </span>
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-border p-4">
                        {guidancePanel}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {executionEnvironment}
              </CardContent>
              <CardFooter className="justify-between px-0 pt-6">
                <Button variant="outline" onClick={() => onStepChange(1)}>
                  <ArrowLeft />
                  Back
                </Button>
                <Button disabled={!reviewReady} onClick={() => onStepChange(3)}>
                  Review batch
                  <ArrowRight />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </StepperContent>

        <StepperContent step={3}>
          <div className="grid gap-5">
            <div>
              <h2 className="text-xl font-semibold">Confirm and launch</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Nothing has started yet. Review the shared settings and
                preflight checks before creating {uniqueUrls.length} parallel
                job{uniqueUrls.length === 1 ? '' : 's'}.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Batch summary</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Jobs</dt>
                      <dd className="mt-1 font-medium">
                        {uniqueUrls.length} unique URL
                        {uniqueUrls.length === 1 ? '' : 's'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Document
                      </dt>
                      <dd className="mt-1 font-medium">
                        {documentKindLabel(form.kind)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Locale</dt>
                      <dd className="mt-1 font-medium">
                        {form.locale || 'Not selected'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Execution
                      </dt>
                      <dd className="mt-1 font-medium">
                        3 jobs · 2 Codex calls concurrently
                      </dd>
                    </div>
                  </dl>
                  <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                    <ol className="divide-y divide-border">
                      {uniqueUrls.map((url, index) => (
                        <li
                          key={url}
                          className="flex items-start gap-3 px-3 py-2.5 text-xs"
                        >
                          <span className="font-mono text-muted-foreground">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="min-w-0 break-all">{url}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="size-4" />
                    Preflight
                  </CardTitle>
                  <CardDescription>
                    All checks must pass before launch.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <PreflightRow
                    ready={urlsValid}
                    label="Job URLs"
                    description={`${uniqueUrls.length} unique, schema-valid URL${uniqueUrls.length === 1 ? '' : 's'}`}
                  />
                  <PreflightRow
                    ready={form.locale.length > 0}
                    label="Facts release"
                    description={
                      form.locale.length > 0
                        ? `Published locale ${form.locale} selected`
                        : 'Choose a published locale'
                    }
                  />
                  <PreflightRow
                    ready={form.kind !== 'cv' || guidanceReady}
                    label="Generation settings"
                    description={
                      form.kind === 'cv'
                        ? 'CV guidance loaded and schema-valid'
                        : 'Cover-letter instructions are ready'
                    }
                  />
                  <PreflightRow
                    ready
                    label="Native runtime"
                    description="Codex will run locally with bounded concurrency"
                  />
                </CardContent>
              </Card>
            </div>

            {startError === null ? null : (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Batch could not start</AlertTitle>
                <AlertDescription>{startError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row">
              <Button
                variant="outline"
                disabled={starting}
                onClick={() => onStepChange(2)}
              >
                <ArrowLeft />
                Back to settings
              </Button>
              <Button disabled={!canStart || starting} onClick={onStart}>
                {starting ? <Spinner aria-hidden /> : <Sparkles />}
                {starting
                  ? 'Starting batch…'
                  : `Start ${uniqueUrls.length} workflow${uniqueUrls.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        </StepperContent>
      </Stepper>
    </WorkflowPage>
  )
}
