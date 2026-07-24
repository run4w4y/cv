import type { ApplicationArtifact } from '@cv/application-registry-entity'
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
} from '@cv/internal-ui'
import { useAtom } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import {
  AlertCircle,
  Download,
  Eye,
  FileArchive,
  FileText,
  RefreshCw,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router'

import { expectedErrorMessage } from '@/lib/async-result'
import { downloadBytes } from '@/lib/download'
import { formatByteSize, formatDateTime, formatLabel } from '@/lib/format'
import {
  type ApplicationArtifactIdentity,
  readApplicationArtifactContent,
  refreshApplicationArtifacts,
} from '../../data'
import { UploadApplicationArtifactDialog } from './upload-dialog'

type ReadArtifactContent = (
  identity: ApplicationArtifactIdentity
) => Promise<Uint8Array>

type RefreshArtifacts = (applicationId: string) => Promise<unknown>

const ArtifactSkeleton = () => (
  <div className="flex items-center gap-3 py-4">
    <Skeleton className="size-10 shrink-0 rounded-md" />
    <div className="min-w-0 flex-1">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-2 h-3 w-64" />
    </div>
    <Skeleton className="h-8 w-36" />
  </div>
)

export const ApplicationArtifactsCard = ({
  applicationId,
  artifacts,
  error,
  readArtifactContent,
  refreshArtifacts,
}: {
  readonly applicationId: string
  readonly artifacts?: readonly ApplicationArtifact[]
  readonly error?: string
  readonly readArtifactContent?: ReadArtifactContent
  readonly refreshArtifacts?: RefreshArtifacts
}) => {
  const [, readContent] = useAtom(readApplicationArtifactContent, {
    mode: 'promise',
  })
  const [refreshResult, refreshContent] = useAtom(refreshApplicationArtifacts, {
    mode: 'promise',
  })
  const [downloadingId, setDownloadingId] = React.useState<string>()
  const [actionError, setActionError] = React.useState<string>()
  const refreshing = AsyncResult.isWaiting(refreshResult)

  const download = async (artifact: ApplicationArtifact) => {
    setDownloadingId(artifact.id)
    setActionError(undefined)
    try {
      const bytes = await (readArtifactContent ?? readContent)({
        applicationId,
        artifactId: artifact.id,
      })
      downloadBytes({
        bytes,
        filename: artifact.filename,
        mediaType: artifact.mediaType,
      })
    } catch (reason) {
      setActionError(
        expectedErrorMessage(reason, 'The artifact could not be downloaded.')
      )
    } finally {
      setDownloadingId(undefined)
    }
  }

  const refresh = async () => {
    setActionError(undefined)
    try {
      await (refreshArtifacts ?? refreshContent)(applicationId)
    } catch (reason) {
      setActionError(
        expectedErrorMessage(reason, 'The artifacts could not be refreshed.')
      )
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileArchive className="size-4 text-primary" />
            <CardTitle>Application artifacts</CardTitle>
          </div>
          <CardDescription className="mt-1.5">
            Resumes, cover letters, and supporting files stored with this
            application.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <UploadApplicationArtifactDialog applicationId={applicationId} />
        </div>
      </CardHeader>
      <CardContent>
        {error !== undefined ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Could not load application artifacts</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : artifacts === undefined ? (
          <div
            className="divide-y divide-border"
            role="status"
            aria-label="Loading artifacts"
          >
            <ArtifactSkeleton />
            <ArtifactSkeleton />
          </div>
        ) : artifacts.length === 0 ? (
          <Empty className="py-9">
            <EmptyHeader>
              <EmptyMedia>
                <FileText />
              </EmptyMedia>
              <EmptyTitle>No artifacts yet</EmptyTitle>
              <EmptyDescription>
                Upload a file here or generate a PDF from the CV workflow.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul
            className="divide-y divide-border"
            aria-label="Application artifacts"
          >
            {artifacts.map((artifact) => (
              <li
                key={artifact.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {artifact.filename}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">
                        {formatLabel(artifact.category)}
                      </Badge>
                      <Badge variant="outline">
                        {formatLabel(artifact.source)}
                      </Badge>
                      {artifact.locale === null ? null : (
                        <Badge variant="outline">{artifact.locale}</Badge>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {artifact.mediaType} ·{' '}
                      {formatByteSize(artifact.byteLength)} ·{' '}
                      {formatDateTime(artifact.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
                  <Link
                    to={`/applications/${encodeURIComponent(
                      applicationId
                    )}/artifacts/${encodeURIComponent(artifact.id)}`}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' })
                    )}
                  >
                    <Eye />
                    View
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={downloadingId !== undefined}
                    onClick={() => void download(artifact)}
                  >
                    <Download />
                    {downloadingId === artifact.id
                      ? 'Downloading…'
                      : 'Download'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {actionError === undefined ? null : (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle />
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
