import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
} from '@cv/internal-ui'
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { CircleAlert, RefreshCw, Sparkles } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router'

import { asyncResultFailureMessage } from '../../async-result'
import { usePreparationCommandGate } from '../../command-gate'
import { ChatGptAccess } from '../../components/chatgpt-access'
import { JobContextEditor } from '../../components/job-context-editor'
import { PreparationPageFrame } from '../../components/page-frame'
import { refreshJobSnapshotCommandAtom } from '../../snapshot-command'
import {
  type PreparationWorkspace,
  preparationWorkspaceAtom,
} from '../../workspace/atoms'
import { type CvPreparationActions, useCvPreparationActions } from './actions'
import { CvEditorCard } from './editor-card'
import { CvGenerationCard } from './generation-card'
import { workflowIsExecuting } from './preparation-commands'
import { CvPreviewCard } from './preview-card'

const WorkflowStatus = ({
  workspace,
}: {
  readonly workspace: PreparationWorkspace
}) => {
  const run = workspace.run
  if (run === null) return null

  return (
    <Alert>
      <Sparkles />
      <AlertTitle>Workflow {run.status.replace('_', ' ')}</AlertTitle>
      <AlertDescription className="grid gap-1">
        <span>{run.message}</span>
        {run.candidate === null ? null : (
          <span>
            Candidate revision {run.candidate.result.revision.revisionNumber}{' '}
            was persisted from snapshot{' '}
            {run.candidate.result.revision.jobSnapshotId} and facts{' '}
            {run.candidate.result.revision.factsReleaseId} before review ·{' '}
            {run.candidate.candidate.metadata.length} AI calls retain model and
            token usage in this browser session.
          </span>
        )}
      </AlertDescription>
    </Alert>
  )
}

const PublicationStatus = ({
  actions,
}: {
  readonly actions: CvPreparationActions
}) => {
  const run = actions.publicationRun
  if (run === null) return null

  return (
    <Alert variant={run._tag === 'Failed' ? 'destructive' : 'default'}>
      {run._tag === 'Failed' ? <CircleAlert /> : <Sparkles />}
      <AlertTitle>Publication {run._tag}</AlertTitle>
      <AlertDescription>{run.message}</AlertDescription>
    </Alert>
  )
}

const CvPreparationReady = ({
  locale,
  onCommandStarted,
  onLocaleChange,
  onRunStarted,
  onSnapshotRefresh,
  refreshError,
  refreshPending,
  workspace,
}: {
  readonly locale: string
  readonly onCommandStarted: () => void
  readonly onLocaleChange: (locale: string) => void
  readonly onRunStarted: (runId: string) => void
  readonly onSnapshotRefresh: () => void
  readonly refreshError: string | null
  readonly refreshPending: boolean
  readonly workspace: PreparationWorkspace
}) => {
  const actions = useCvPreparationActions({
    onCommandStarted,
    onRunStarted,
    workspace,
  })
  const error = actions.error ?? refreshError

  return (
    <>
      <JobContextEditor
        applicationId={workspace.editor.identity.applicationId}
        initialContext={workspace.bootstrap.context.jobContext}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChatGptAccess />
        <CvGenerationCard
          actions={actions}
          locale={locale}
          onLocaleChange={(value) => {
            actions.resetCommandResults()
            onLocaleChange(value)
          }}
          onRefreshSnapshot={() => {
            actions.resetCommandResults()
            onSnapshotRefresh()
          }}
          refreshPending={refreshPending}
          workspace={workspace}
        />
      </div>

      <WorkflowStatus workspace={workspace} />
      <PublicationStatus actions={actions} />

      {error === null ? null : (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Preparation step failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.85fr)]">
        <CvEditorCard actions={actions} workspace={workspace} />
        <CvPreviewCard actions={actions} workspace={workspace} />
      </div>
    </>
  )
}

export const CvPreparationPage = () => {
  const { applicationId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = searchParams.get('locale') ?? 'en'
  const requestedRunId = searchParams.get('run')
  const editorIdentity = {
    applicationId,
    kind: 'cv',
    locale,
  } as const
  const workspaceResult = useAtomValue(
    preparationWorkspaceAtom({
      ...editorIdentity,
      requestedRunId,
    })
  )
  const refreshCommandAtom = refreshJobSnapshotCommandAtom(editorIdentity)
  const [refreshResult, refreshSnapshot] = useAtom(refreshCommandAtom, {
    mode: 'promise',
  })
  const resetRefreshResult = useAtomSet(refreshCommandAtom)
  const commandGate = usePreparationCommandGate(editorIdentity)
  const refreshPending = AsyncResult.isWaiting(refreshResult)
  const refreshError = asyncResultFailureMessage(
    refreshResult,
    'The job posting could not be refreshed.'
  )
  const workspaceError = asyncResultFailureMessage(
    workspaceResult,
    'The job snapshot, active facts release, or CV entry could not be loaded.'
  )

  const updateRun = (runId: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('run', runId)
      return next
    })
  }
  const updateLocale = (nextLocale: string) => {
    if (nextLocale === locale || commandGate.executing) return
    resetRefreshResult(Atom.Reset)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('locale', nextLocale)
      next.delete('run')
      return next
    })
  }
  const refresh = async () => {
    const run =
      workspaceResult._tag === 'Success' ? workspaceResult.value.run : null
    if (refreshPending || workflowIsExecuting(run) || !commandGate.claim()) {
      return
    }
    resetRefreshResult(Atom.Reset)
    try {
      await refreshSnapshot(applicationId)
    } catch {
      // The mutation atom retains the typed failure rendered by this page.
    } finally {
      commandGate.release()
    }
  }

  return (
    <PreparationPageFrame
      applicationId={applicationId}
      eyebrow="Application preparation"
      title="Tailor the CV"
      description="Generate from the latest job snapshot and active reviewed facts, then inspect, edit, save, preview, approve, and publish one schema-valid revision."
    >
      {workspaceResult._tag === 'Success' ? (
        <CvPreparationReady
          locale={locale}
          onCommandStarted={() => resetRefreshResult(Atom.Reset)}
          onLocaleChange={updateLocale}
          onRunStarted={updateRun}
          onSnapshotRefresh={() => void refresh()}
          refreshError={refreshError}
          refreshPending={refreshPending}
          workspace={workspaceResult.value}
        />
      ) : workspaceError === null ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading the job snapshot, active facts release, and CV entry…
          </CardContent>
        </Card>
      ) : (
        <>
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Preparation context unavailable</AlertTitle>
            <AlertDescription className="grid gap-3">
              <span>{workspaceError}</span>
              <Button
                className="w-fit"
                variant="outline"
                disabled={refreshPending}
                onClick={() => void refresh()}
              >
                <RefreshCw />
                {refreshPending
                  ? 'Refreshing posting…'
                  : 'Capture posting again'}
              </Button>
            </AlertDescription>
          </Alert>
          <JobContextEditor applicationId={applicationId} />
        </>
      )}
    </PreparationPageFrame>
  )
}
