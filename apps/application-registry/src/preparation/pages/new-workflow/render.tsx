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
} from '@/preparation/data'
import {
  cvGenerationGuidanceOverrideAtom,
  isValidCvGenerationGuidance,
} from '@/preparation/guidance/atoms'
import { CvGenerationGuidanceSummary } from '@/preparation/guidance/summary'
import { startPreparationBatchAtom } from '@/preparation/workflow/atoms'
import { WorkflowDesktopUnavailable } from '@/preparation/workflows/desktop-unavailable'
import { NewWorkflowScreen } from '@/preparation/workflows/new-workflow-screen'

type GuidanceState = {
  readonly guidance: CvGenerationGuidanceV1 | null
  readonly panel: React.ReactNode
  readonly ready: boolean
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
  guidance,
  guidancePanel,
  guidanceReady,
  locales,
}: {
  readonly guidance: CvGenerationGuidanceV1 | null
  readonly guidancePanel: React.ReactNode
  readonly guidanceReady: boolean
  readonly locales: ReadonlyArray<string>
}) => {
  const navigate = useNavigate()
  const [form, setForm] = useAtom(batchPreparationFormAtom)
  const [step, setStep] = useAtom(batchPreparationStepAtom)
  const validation = useAtomValue(batchPreparationValidationAtom)
  const [startResult, startBatch] = useAtom(startPreparationBatchAtom, {
    mode: 'promiseExit',
  })
  const resetStart = useAtomSet(startPreparationBatchAtom)
  const [commandExecuting, setCommandExecuting] = useAtom(
    batchPreparationCommandGateAtom
  )
  const starting = commandExecuting || AsyncResult.isWaiting(startResult)
  const startError =
    asyncResultErrorMessage(
      startResult,
      'The workflow batch could not be started.'
    ) ?? null
  const canStart = validation.canStart && (form.kind !== 'cv' || guidanceReady)

  const start = async () => {
    if (!canStart || starting) return
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
        coverLetterPrompt:
          form.kind === 'cover_letter' ? form.prompt.trim() : null,
        cvGenerationGuidance: form.kind === 'cv' ? guidance : null,
        kind: form.kind,
        locale: form.locale,
        urls: validation.urls,
      })
      if (Exit.isFailure(exit)) return
      const batchId = exit.value[0]?.batchId
      if (batchId === undefined) return
      setForm((current) => ({ ...current, urls: '' }))
      setStep(1)
      navigate(`/workflows/${encodeURIComponent(batchId)}`)
    } finally {
      setCommandExecuting(false)
    }
  }

  return (
    <NewWorkflowScreen
      canStart={canStart}
      executionEnvironment={<LocalCodex variant="compact" />}
      form={form}
      guidancePanel={guidancePanel}
      guidanceReady={guidanceReady}
      localeError={null}
      locales={locales}
      onFormChange={setForm}
      onStart={() => void start()}
      onStepChange={setStep}
      promptCharactersRemaining={validation.promptCharactersRemaining}
      rows={validation.rows}
      startError={startError}
      starting={starting}
      step={step}
      tooLarge={validation.tooLarge}
      uniqueUrls={validation.urls}
      urlsValid={validation.urlsValid}
    />
  )
}

const NewWorkflowWithMetadata = ({
  locales,
}: {
  readonly locales: ReadonlyArray<string>
}) => {
  const [form, setForm] = useAtom(batchPreparationFormAtom)
  const setStep = useAtomSet(batchPreparationStepAtom)
  const [searchParams] = useSearchParams()
  const prefilled = React.useRef(false)

  React.useEffect(() => {
    if (prefilled.current) return
    prefilled.current = true
    const requestedUrl = searchParams.get('url')
    const requestedKind = searchParams.get('kind')
    const requestedLocale = searchParams.get('locale')
    if (
      requestedUrl === null &&
      requestedKind === null &&
      requestedLocale === null
    ) {
      return
    }

    setForm((current) => ({
      ...current,
      kind:
        requestedKind === 'cv' || requestedKind === 'cover_letter'
          ? requestedKind
          : current.kind,
      locale:
        requestedLocale !== null && locales.includes(requestedLocale)
          ? requestedLocale
          : current.locale,
      urls: requestedUrl ?? current.urls,
    }))
    setStep(1)
  }, [locales, searchParams, setForm, setStep])

  if (form.kind !== 'cv') {
    return (
      <NewWorkflowController
        guidance={null}
        guidancePanel={
          <p className="text-sm text-muted-foreground">
            CV writing guidance is only used for CV workflows.
          </p>
        }
        guidanceReady={true}
        locales={locales}
      />
    )
  }

  return (
    <CvGuidanceController>
      {(state) => (
        <NewWorkflowController
          guidance={state.guidance}
          guidancePanel={state.panel}
          guidanceReady={state.ready}
          locales={locales}
        />
      )}
    </CvGuidanceController>
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
