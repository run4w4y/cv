import type { AiWorkflowTarget } from '@cv/application-preparation-workflow/domain'
import type { Application } from '@cv/application-registry-entity'
import type { CvGenerationGuidanceV1 } from '@cv/contracts/document'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  Spinner,
} from '@cv/internal-ui'
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import { Exit } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { CircleAlert } from 'lucide-react'
import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { applicationAtom } from '@/applications/data'
import { activeFactsReleaseAtom } from '@/facts/data'
import { isDesktopHost } from '@/host/desktop'
import { asyncResultErrorMessage } from '@/lib/async-result'
import {
  batchPreparationCommandGateAtom,
  batchPreparationFormAtom,
  batchPreparationStepAtom,
  batchPreparationValidationAtom,
} from '@/preparation/batch/atoms'
import { LocalCodex } from '@/preparation/components/local-codex'
import {
  type ActiveCvGenerationGuidance,
  activeCvGenerationGuidanceAtom,
  preparationContextAtom,
} from '@/preparation/data'
import {
  cvGenerationGuidanceOverrideAtom,
  isValidCvGenerationGuidance,
} from '@/preparation/guidance/atoms'
import { CvGenerationGuidanceSummary } from '@/preparation/guidance/summary'
import { createAiWorkflowBatchAtom } from '@/preparation/workflow/atoms'
import { WorkflowDesktopUnavailable } from '@/preparation/workflows/desktop-unavailable'
import { NewWorkflowScreen } from '@/preparation/workflows/new-workflow-screen'
import { existingApplicationWorkflowTarget } from './target'

type GuidanceState = {
  readonly guidance: CvGenerationGuidanceV1 | null
  readonly panel: React.ReactNode
  readonly ready: boolean
}

type ExistingApplicationLaunch = {
  readonly application: Application
  readonly contextMessage: string
  readonly contextStatus: 'waiting-for-locale' | 'loading' | 'ready' | 'error'
  readonly target: AiWorkflowTarget | null
}

const CvGuidanceController = ({
  children,
}: {
  readonly children: (state: GuidanceState) => React.ReactNode
}) => {
  const guidanceResult = useAtomValue(activeCvGenerationGuidanceAtom)

  if (!AsyncResult.isSuccess(guidanceResult)) {
    const failed = AsyncResult.isFailure(guidanceResult)
    const message =
      asyncResultErrorMessage(
        guidanceResult,
        'CV guidance could not be loaded from the active facts release.'
      ) ?? 'Loading reviewed guidance…'
    return children({
      guidance: null,
      panel: (
        <Alert variant={failed ? 'destructive' : 'default'}>
          {failed ? <CircleAlert /> : <Spinner aria-hidden />}
          <AlertTitle>
            {failed ? 'CV guidance unavailable' : 'Loading CV guidance'}
          </AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ),
      ready: false,
    })
  }

  return (
    <LoadedCvGuidanceController loaded={guidanceResult.value}>
      {children}
    </LoadedCvGuidanceController>
  )
}

const LoadedCvGuidanceController = ({
  children,
  loaded,
}: {
  readonly children: (state: GuidanceState) => React.ReactNode
  readonly loaded: ActiveCvGenerationGuidance
}) => {
  const override = useAtomValue(
    cvGenerationGuidanceOverrideAtom(loaded.factsReleaseId)
  )
  const guidance = override ?? loaded.guidance
  const ready = isValidCvGenerationGuidance(guidance)

  return children({
    guidance,
    panel: (
      <CvGenerationGuidanceSummary
        base={loaded.guidance}
        factsReleaseId={loaded.factsReleaseId}
        value={guidance}
      />
    ),
    ready,
  })
}

const NewWorkflowController = ({
  existingApplication,
  guidance,
  guidancePanel,
  guidanceReady,
  locales,
}: {
  readonly existingApplication: ExistingApplicationLaunch | null
  readonly guidance: CvGenerationGuidanceV1 | null
  readonly guidancePanel: React.ReactNode
  readonly guidanceReady: boolean
  readonly locales: ReadonlyArray<string>
}) => {
  const navigate = useNavigate()
  const [form, setForm] = useAtom(batchPreparationFormAtom)
  const [step, setStep] = useAtom(batchPreparationStepAtom)
  const validation = useAtomValue(batchPreparationValidationAtom)
  const [startResult, startBatch] = useAtom(createAiWorkflowBatchAtom, {
    mode: 'promiseExit',
  })
  const resetStart = useAtomSet(createAiWorkflowBatchAtom)
  const [commandExecuting, setCommandExecuting] = useAtom(
    batchPreparationCommandGateAtom
  )
  const starting = commandExecuting || AsyncResult.isWaiting(startResult)
  const startError =
    asyncResultErrorMessage(
      startResult,
      'The workflow batch could not be started.'
    ) ?? null
  const targets =
    existingApplication === null
      ? validation.targets
      : existingApplication.target === null
        ? []
        : [existingApplication.target]
  const targetsValid =
    existingApplication === null ? validation.targetsValid : true
  const targetContextReady =
    existingApplication === null || existingApplication.target !== null
  const targetUrls =
    existingApplication === null
      ? validation.targets.map((target) => target.url)
      : [existingApplication.application.postingUrl]
  const localeError =
    form.locale.length > 0 && !locales.includes(form.locale)
      ? 'Select a locale published by the active facts release.'
      : null
  const canStart =
    targets.length > 0 &&
    targetsValid &&
    validation.settingsValid &&
    localeError === null &&
    guidanceReady &&
    guidance !== null

  const start = async () => {
    if (!canStart || starting || guidance === null || targets.length === 0) {
      return
    }
    let claimed = false
    setCommandExecuting((current) => {
      if (current) return current
      claimed = true
      return true
    })
    if (!claimed) return

    resetStart(Atom.Reset)
    try {
      const exit = await startBatch({
        artifacts: {
          coverLetter: form.includeCoverLetter
            ? { prompt: form.prompt.trim() }
            : null,
          cv: { generationGuidance: guidance },
        },
        locale: form.locale,
        targets,
      })
      if (Exit.isFailure(exit)) return
      const batchId = exit.value[0]?.batchId
      if (batchId === undefined) return
      setForm((current) => ({ ...current, postingUrls: '' }))
      setStep(1)
      navigate(`/ai-workflows/${encodeURIComponent(batchId)}`)
    } finally {
      setCommandExecuting(false)
    }
  }

  return (
    <NewWorkflowScreen
      canStart={canStart}
      existingApplication={
        existingApplication === null
          ? null
          : {
              applicationId: existingApplication.application.id,
              company: existingApplication.application.company,
              contextMessage: existingApplication.contextMessage,
              contextStatus: existingApplication.contextStatus,
              postingUrl: existingApplication.application.postingUrl,
              role: existingApplication.application.role,
            }
      }
      executionEnvironment={<LocalCodex variant="compact" />}
      form={form}
      guidancePanel={guidancePanel}
      guidanceReady={guidanceReady}
      localeError={localeError}
      locales={locales}
      onFormChange={setForm}
      onStart={() => void start()}
      onStepChange={setStep}
      promptCharactersRemaining={validation.promptCharactersRemaining}
      rows={validation.rows}
      startError={startError}
      starting={starting}
      step={step}
      targetContextReady={targetContextReady}
      targetUrls={targetUrls}
      targetsValid={targetsValid}
      tooLarge={validation.tooLarge}
    />
  )
}

const GuidedNewWorkflow = ({
  existingApplication,
  locales,
}: {
  readonly existingApplication: ExistingApplicationLaunch | null
  readonly locales: ReadonlyArray<string>
}) => (
  <CvGuidanceController>
    {(state) => (
      <NewWorkflowController
        existingApplication={existingApplication}
        guidance={state.guidance}
        guidancePanel={state.panel}
        guidanceReady={state.ready}
        locales={locales}
      />
    )}
  </CvGuidanceController>
)

const ResolvedExistingApplicationContext = ({
  application,
  locale,
  locales,
}: {
  readonly application: Application
  readonly locale: string
  readonly locales: ReadonlyArray<string>
}) => {
  const contextResult = useAtomValue(
    preparationContextAtom({
      applicationId: application.id,
      locale,
    })
  )
  const context = AsyncResult.isSuccess(contextResult)
    ? contextResult.value
    : null
  const contextError =
    asyncResultErrorMessage(
      contextResult,
      'The application context could not be pinned for this workflow.'
    ) ?? null
  const existingApplication: ExistingApplicationLaunch = {
    application,
    contextMessage:
      context !== null
        ? 'Reviewed application context is pinned and ready.'
        : (contextError ??
          'Loading the current job snapshot and active facts release…'),
    contextStatus:
      context !== null ? 'ready' : contextError === null ? 'loading' : 'error',
    target:
      context === null
        ? null
        : existingApplicationWorkflowTarget(application, context),
  }

  return (
    <GuidedNewWorkflow
      existingApplication={existingApplication}
      locales={locales}
    />
  )
}

const ExistingApplicationContext = ({
  application,
  locales,
}: {
  readonly application: Application
  readonly locales: ReadonlyArray<string>
}) => {
  const form = useAtomValue(batchPreparationFormAtom)

  if (form.locale.length > 0) {
    return (
      <ResolvedExistingApplicationContext
        application={application}
        locale={form.locale}
        locales={locales}
      />
    )
  }

  return (
    <GuidedNewWorkflow
      existingApplication={{
        application,
        contextMessage:
          'Select a facts locale to load and pin this application’s reviewed context.',
        contextStatus: 'waiting-for-locale',
        target: null,
      }}
      locales={locales}
    />
  )
}

const ExistingApplicationTarget = ({
  applicationId,
  locales,
}: {
  readonly applicationId: string
  readonly locales: ReadonlyArray<string>
}) => {
  const applicationResult = useAtomValue(applicationAtom(applicationId))

  if (AsyncResult.isSuccess(applicationResult)) {
    return (
      <ExistingApplicationContext
        application={applicationResult.value}
        locales={locales}
      />
    )
  }

  const error =
    asyncResultErrorMessage(
      applicationResult,
      'The selected application could not be loaded.'
    ) ?? null

  return (
    <Card className="m-auto w-full max-w-xl">
      <CardContent className="p-6 text-sm text-muted-foreground">
        {error === null ? (
          <span className="flex items-center gap-2">
            <Spinner aria-hidden />
            Loading existing application…
          </span>
        ) : (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Application unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

const NewWorkflowWithMetadata = ({
  locales,
}: {
  readonly locales: ReadonlyArray<string>
}) => {
  const setForm = useAtomSet(batchPreparationFormAtom)
  const setStep = useAtomSet(batchPreparationStepAtom)
  const [searchParams] = useSearchParams()
  const prefilled = React.useRef(false)
  const applicationId = searchParams.get('applicationId')?.trim() || null

  React.useEffect(() => {
    if (prefilled.current) return
    prefilled.current = true
    const requestedPostingUrls = searchParams
      .getAll('postingUrl')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
    const requestedLocale = searchParams.get('locale')

    setForm((current) => ({
      ...current,
      locale:
        requestedLocale !== null && locales.includes(requestedLocale)
          ? requestedLocale
          : locales.includes(current.locale)
            ? current.locale
            : '',
      postingUrls:
        requestedPostingUrls.length === 0
          ? current.postingUrls
          : requestedPostingUrls.join('\n'),
    }))
    setStep(1)
  }, [locales, searchParams, setForm, setStep])

  return applicationId === null ? (
    <GuidedNewWorkflow existingApplication={null} locales={locales} />
  ) : (
    <ExistingApplicationTarget
      applicationId={applicationId}
      locales={locales}
    />
  )
}

export const NewWorkflowPage = () => {
  const metadataResult = useAtomValue(activeFactsReleaseAtom)

  if (!isDesktopHost()) return <WorkflowDesktopUnavailable />

  if (AsyncResult.isSuccess(metadataResult)) {
    return <NewWorkflowWithMetadata locales={metadataResult.value.locales} />
  }

  const error =
    asyncResultErrorMessage(
      metadataResult,
      'The active facts release metadata could not be loaded.'
    ) ?? null

  return (
    <Card className="m-auto w-full max-w-xl">
      <CardContent className="p-6 text-sm text-muted-foreground">
        {error === null ? (
          <span className="flex items-center gap-2">
            <Spinner aria-hidden />
            Loading published facts locales…
          </span>
        ) : (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Facts locales unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
