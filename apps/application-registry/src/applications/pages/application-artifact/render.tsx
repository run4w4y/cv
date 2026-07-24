import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Skeleton,
} from '@cv/internal-ui'
import { useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import {
  AlertCircle,
  ArrowLeft,
  Download,
  FileQuestion,
  FileText,
} from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router'

import { asyncResultErrorMessage } from '@/lib/async-result'
import { binaryBlob, downloadBytes } from '@/lib/download'
import { formatByteSize, formatDateTime, formatLabel } from '@/lib/format'
import { HeaderActions } from '@/shell/header-actions'
import {
  applicationArtifactAtom,
  applicationArtifactContentAtom,
} from '../../data'

const PdfArtifactPreview = ({
  bytes,
  filename,
  mediaType,
}: {
  readonly bytes: Uint8Array
  readonly filename: string
  readonly mediaType: string
}) => {
  const [objectUrl, setObjectUrl] = React.useState<string>()

  React.useEffect(() => {
    const nextObjectUrl = URL.createObjectURL(binaryBlob({ bytes, mediaType }))
    setObjectUrl(nextObjectUrl)
    return () => URL.revokeObjectURL(nextObjectUrl)
  }, [bytes, mediaType])

  return objectUrl === undefined ? (
    <Skeleton className="h-[calc(100vh-15rem)] min-h-128 w-full" />
  ) : (
    <iframe
      className="h-[calc(100vh-15rem)] min-h-128 w-full rounded-md border border-border bg-white"
      src={objectUrl}
      title={`${filename} preview`}
    />
  )
}

export const ApplicationArtifactPage = () => {
  const { applicationId = '', artifactId = '' } = useParams()
  const identity = React.useMemo(
    () => ({ applicationId, artifactId }),
    [applicationId, artifactId]
  )
  const artifactResult = useAtomValue(applicationArtifactAtom(identity))
  const contentResult = useAtomValue(applicationArtifactContentAtom(identity))
  const artifact = AsyncResult.getOrElse(artifactResult, () => undefined)
  const bytes = AsyncResult.getOrElse(contentResult, () => undefined)
  const artifactError = asyncResultErrorMessage(
    artifactResult,
    'The artifact metadata could not be loaded.'
  )
  const contentError = asyncResultErrorMessage(
    contentResult,
    'The artifact content could not be loaded.'
  )
  const isPdf =
    artifact?.mediaType.split(';', 1)[0]?.trim().toLowerCase() ===
    'application/pdf'
  const download = () => {
    if (artifact === undefined || bytes === undefined) return
    downloadBytes({
      bytes,
      filename: artifact.filename,
      mediaType: artifact.mediaType,
    })
  }

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-background p-4 lg:p-6">
      {artifact === undefined || bytes === undefined ? null : (
        <HeaderActions>
          <Button type="button" size="sm" onClick={download}>
            <Download />
            Download
          </Button>
        </HeaderActions>
      )}
      <div className="mx-auto max-w-6xl">
        <Link
          to={`/applications/${encodeURIComponent(applicationId)}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
        >
          <ArrowLeft />
          Back to application
        </Link>

        {artifactError !== undefined ? (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle />
            <AlertTitle>Could not load this artifact</AlertTitle>
            <AlertDescription>{artifactError}</AlertDescription>
          </Alert>
        ) : artifact === undefined ? (
          <Card className="mt-4">
            <CardContent className="p-6">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="mt-3 h-4 w-96 max-w-full" />
              <Skeleton className="mt-6 h-128 w-full" />
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-4">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-primary" />
                    <CardTitle className="break-all">
                      {artifact.filename}
                    </CardTitle>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">
                      {formatLabel(artifact.category)}
                    </Badge>
                    <Badge variant="outline">
                      {formatLabel(artifact.source)}
                    </Badge>
                    {artifact.locale === null ? null : (
                      <Badge variant="outline">{artifact.locale}</Badge>
                    )}
                    <span>{artifact.mediaType}</span>
                    <span>{formatByteSize(artifact.byteLength)}</span>
                    <span>{formatDateTime(artifact.createdAt)}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={bytes === undefined}
                  onClick={download}
                >
                  <Download />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {contentError !== undefined ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Could not load artifact content</AlertTitle>
                  <AlertDescription>{contentError}</AlertDescription>
                </Alert>
              ) : bytes === undefined ? (
                <Skeleton className="h-128 w-full" />
              ) : isPdf ? (
                <PdfArtifactPreview
                  key={`${artifact.id}:${artifact.sha256}`}
                  bytes={bytes}
                  filename={artifact.filename}
                  mediaType={artifact.mediaType}
                />
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-md border border-dashed border-border px-6 text-center">
                  <FileQuestion className="size-10 text-muted-foreground" />
                  <h2 className="mt-4 text-base font-semibold">
                    Preview unavailable
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    This file type cannot be previewed here. Download the
                    artifact to open it with an appropriate application.
                  </p>
                  <Button type="button" className="mt-5" onClick={download}>
                    <Download />
                    Download {artifact.filename}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}
