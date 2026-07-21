import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Progress,
} from '@cv/internal-ui'
import { useAtomValue } from '@effect/atom-react'
import {
  Ban,
  Check,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileDown,
  Globe2,
  Send,
} from 'lucide-react'
import type React from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { asyncResultErrorMessage } from '@/lib/async-result'
import { PreparationPageFrame } from '@/preparation/components/page-frame'
import {
  currentCvPdfArtifact,
  cvPublicationIsShareable,
} from '@/preparation/publication'
import {
  type PreparationWorkspace,
  preparationWorkspaceAtom,
} from '@/preparation/workspace/atoms'
import type { CvPreparationActions } from '../cv-preparation/actions'
import { useCvPreparationActions } from '../cv-preparation/actions'
import { CvPreviewCard } from '../cv-preparation/preview-card'

type ReadinessState = 'blocked' | 'complete' | 'current' | 'pending'

const readinessVariant = (state: ReadinessState) =>
  state === 'complete'
    ? 'success'
    : state === 'blocked'
      ? 'danger'
      : state === 'current'
        ? 'warning'
        : 'outline'

const readinessLabel = (state: ReadinessState) =>
  state === 'complete'
    ? 'Ready'
    : state === 'blocked'
      ? 'Blocked'
      : state === 'current'
        ? 'In progress'
        : 'Waiting'

const ReadinessItem = ({
  description,
  icon,
  state,
  title,
}: {
  readonly description: string
  readonly icon: React.ReactNode
  readonly state: ReadinessState
  readonly title: string
}) => (
  <li className="grid gap-3 rounded-lg border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-3">
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full border',
          state === 'complete' &&
            'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
          state === 'blocked' &&
            'border-destructive/30 bg-destructive/10 text-destructive',
          state === 'current' &&
            'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
          state === 'pending' && 'border-border bg-muted text-muted-foreground'
        )}
      >
        {icon}
      </span>
      <Badge variant={readinessVariant(state)}>{readinessLabel(state)}</Badge>
    </div>
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs/5 text-muted-foreground">{description}</p>
    </div>
  </li>
)

const PublicationRunStatus = ({
  actions,
}: {
  readonly actions: CvPreparationActions
}) => {
  const run = actions.publicationRun
  if (run === null) return null

  return (
    <Alert variant={run._tag === 'Failed' ? 'destructive' : 'default'}>
      {run._tag === 'Failed' ? <CircleAlert /> : <Clock3 />}
      <AlertTitle>Publication workflow · {run._tag}</AlertTitle>
      <AlertDescription className="grid gap-3">
        <span>{run.message}</span>
        {!actions.publicationExecuting ? null : (
          <Button
            className="w-fit"
            size="sm"
            variant="outline"
            disabled={actions.commandPending}
            onClick={() => void actions.cancelPublishing()}
          >
            <Ban />
            {actions.cancellingPublication
              ? 'Cancelling…'
              : 'Cancel publication'}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

const CvPublicationReady = ({
  backTarget,
  workspace,
}: {
  readonly backTarget: string
  readonly workspace: PreparationWorkspace
}) => {
  const actions = useCvPreparationActions({
    onRunStarted: () => undefined,
    workspace,
  })
  const revision = workspace.editor.baseRevision?.revision ?? null
  const publication = actions.publication
  const stagedRevisionIsCurrent =
    publication !== null &&
    revision !== null &&
    publication.link.currentRevisionId === revision.id
  const pdfArtifact =
    publication === null ? null : currentCvPdfArtifact(publication)
  const pdfReady = pdfArtifact?.status === 'ready'
  const shareable =
    publication === null ? false : cvPublicationIsShareable(publication)
  const approved = workspace.editor.isApproved
  const completedSteps =
    Number(approved) +
    Number(stagedRevisionIsCurrent) +
    Number(pdfReady) +
    Number(shareable)
  const canPublish =
    approved &&
    stagedRevisionIsCurrent &&
    publication !== null &&
    !publication.link.enabled &&
    !actions.commandPending &&
    !actions.publicationExecuting
  const workflowContext = workspace.run

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge variant={approved ? 'success' : 'warning'}>
          {approved ? 'Approved revision' : 'Approval required'}
        </Badge>
        {revision === null ? null : (
          <Badge variant="outline">Revision {revision.revisionNumber}</Badge>
        )}
        <Badge variant="outline">{workspace.editor.identity.locale}</Badge>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Release readiness</CardTitle>
              <CardDescription className="mt-1">
                Publication advances one approved revision through staging, PDF
                generation, and public availability.
              </CardDescription>
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {completedSteps} of 4 ready
            </span>
          </div>
          <Progress
            aria-label="CV publication readiness"
            value={(completedSteps / 4) * 100}
          />
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReadinessItem
              title="Revision approved"
              description={
                approved
                  ? `Revision ${revision?.revisionNumber ?? ''} is locked as the approved head.`
                  : 'Return to review and approve the revision before publishing.'
              }
              icon={<Check className="size-4" />}
              state={approved ? 'complete' : 'blocked'}
            />
            <ReadinessItem
              title="Preview staged"
              description={
                stagedRevisionIsCurrent
                  ? 'The private page uses the approved head revision.'
                  : publication === null
                    ? 'No private preview has been staged for this CV.'
                    : 'The staged preview points to an earlier revision.'
              }
              icon={<FileCheck2 className="size-4" />}
              state={
                stagedRevisionIsCurrent
                  ? 'complete'
                  : publication === null
                    ? 'blocked'
                    : 'current'
              }
            />
            <ReadinessItem
              title="PDF artifact"
              description={
                pdfArtifact?.status === 'ready'
                  ? 'The current publication version has a downloadable PDF.'
                  : pdfArtifact?.status === 'pending'
                    ? 'The PDF worker is rendering the current publication version.'
                    : pdfArtifact?.status === 'failed'
                      ? 'PDF generation failed and can be retried below.'
                      : 'A PDF will be generated after the page is published.'
              }
              icon={<FileDown className="size-4" />}
              state={
                pdfReady
                  ? 'complete'
                  : pdfArtifact?.status === 'pending'
                    ? 'current'
                    : pdfArtifact?.status === 'failed'
                      ? 'blocked'
                      : 'pending'
              }
            />
            <ReadinessItem
              title="Public link"
              description={
                shareable
                  ? 'The page is public and its current PDF is ready.'
                  : publication?.link.enabled
                    ? 'The page is enabled and waiting for a ready PDF.'
                    : 'The staged page remains private until publication starts.'
              }
              icon={<Globe2 className="size-4" />}
              state={
                shareable
                  ? 'complete'
                  : publication?.link.enabled
                    ? 'current'
                    : 'pending'
              }
            />
          </ol>
        </CardContent>
      </Card>

      {!approved || !stagedRevisionIsCurrent ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Publication is blocked</AlertTitle>
          <AlertDescription className="grid gap-3">
            <span>
              {!approved
                ? 'The current revision still needs an approval decision.'
                : publication === null
                  ? 'The approved revision does not have a staged private page.'
                  : 'The private page is not staged from the current approved revision.'}
            </span>
            <Link
              to={backTarget}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'w-fit'
              )}
            >
              Return to review
            </Link>
          </AlertDescription>
        </Alert>
      ) : publication.link.enabled ? null : (
        <Alert>
          <Send />
          <AlertTitle>Ready to publish the approved revision</AlertTitle>
          <AlertDescription className="grid gap-3">
            <span>
              This starts the publication workflow, enables the staged page, and
              requests its PDF artifact. The editor is not changed.
            </span>
            <Button
              className="w-fit"
              disabled={!canPublish}
              onClick={() => void actions.publish()}
            >
              <Send />
              {actions.publishing ? 'Starting publication…' : 'Publish CV'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <PublicationRunStatus actions={actions} />

      {actions.error === null ? null : (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Publication step failed</AlertTitle>
          <AlertDescription>{actions.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <CvPreviewCard
          actions={actions}
          presentation="publication"
          workspace={workspace}
        />
        <Card className="h-fit xl:sticky xl:top-0">
          <CardHeader>
            <CardTitle>Release context</CardTitle>
            <CardDescription>
              The immutable inputs behind the revision selected for release.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Application
                </dt>
                <dd className="mt-1 font-medium">
                  {workspace.bootstrap.application.company} ·{' '}
                  {workspace.bootstrap.application.role}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Revision
                </dt>
                <dd className="mt-1">
                  {revision === null
                    ? 'No saved revision'
                    : `#${revision.revisionNumber} · ${revision.source}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Job snapshot
                </dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {revision?.jobSnapshotId ?? 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Facts release
                </dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {revision?.factsReleaseId ?? 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Preparation workflow
                </dt>
                <dd className="mt-1">
                  {workflowContext === null
                    ? 'No linked in-memory run'
                    : `${workflowContext.status.replace('_', ' ')} · ${workflowContext.runId}`}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

const isSafeInternalTarget = (value: string): boolean => {
  const containsControlCharacter = value.split('').some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })

  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !containsControlCharacter
  )
}

const defaultReviewTarget = ({
  applicationId,
  locale,
  runId,
}: {
  readonly applicationId: string
  readonly locale: string
  readonly runId: string | null
}) => {
  const query = new URLSearchParams({ locale })
  if (runId !== null) query.set('run', runId)
  query.set('focus', 'review')
  return `/applications/${encodeURIComponent(applicationId)}/prepare?${query.toString()}`
}

const CvPublicationWorkspace = ({
  applicationId,
  backTarget,
  locale,
  requestedRunId,
}: {
  readonly applicationId: string
  readonly backTarget: string
  readonly locale: string
  readonly requestedRunId: string | null
}) => {
  const workspaceResult = useAtomValue(
    preparationWorkspaceAtom({
      applicationId,
      kind: 'cv',
      locale,
      requestedRunId,
    })
  )
  const workspaceError =
    asyncResultErrorMessage(
      workspaceResult,
      'The approved CV revision and its publication state could not be loaded.'
    ) ?? null

  if (workspaceResult._tag === 'Success') {
    return (
      <CvPublicationReady
        backTarget={backTarget}
        workspace={workspaceResult.value}
      />
    )
  }

  if (workspaceError === null) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading the approved revision, private preview, and publication
          artifacts…
        </CardContent>
      </Card>
    )
  }

  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>Publication context unavailable</AlertTitle>
      <AlertDescription className="grid gap-3">
        <span>{workspaceError}</span>
        <Link
          to={backTarget}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'w-fit'
          )}
        >
          Return to review
        </Link>
      </AlertDescription>
    </Alert>
  )
}

export const CvPublicationPage = () => {
  const { applicationId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const locale = searchParams.get('locale')?.trim() ?? ''
  const requestedRunId = searchParams.get('run')
  const fallbackBackTarget = defaultReviewTarget({
    applicationId,
    locale,
    runId: requestedRunId,
  })
  const requestedBackTarget = searchParams.get('back')
  const backTarget =
    requestedBackTarget !== null && isSafeInternalTarget(requestedBackTarget)
      ? requestedBackTarget
      : fallbackBackTarget

  return (
    <PreparationPageFrame
      applicationId={applicationId}
      backLabel="Back to review"
      eyebrow="CV release"
      title="Publish the CV"
      description="Release one approved revision deliberately. Verify the staged page, follow PDF generation, and control when the public link is available."
    >
      {locale === '' ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Publication locale missing</AlertTitle>
          <AlertDescription>
            Open publication from a reviewed CV revision so its explicit locale
            is preserved.
          </AlertDescription>
        </Alert>
      ) : (
        <CvPublicationWorkspace
          applicationId={applicationId}
          backTarget={backTarget}
          locale={locale}
          requestedRunId={requestedRunId}
        />
      )}
    </PreparationPageFrame>
  )
}
