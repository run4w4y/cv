import { Badge, Button } from '@cv/internal-ui'
import { Download, ExternalLink, EyeOff, RefreshCw } from 'lucide-react'

import type { CvPageState } from '../data'

export type CvPublicationPanelPendingAction =
  | 'availability'
  | 'download'
  | 'pdf'
  | 'refresh'
  | null

export const CvPublicationPanel = ({
  currentHeadRevisionId,
  disabled,
  onDownload,
  onGeneratePdf,
  onRefresh,
  onSetAvailability,
  pendingAction,
  publication,
}: {
  readonly currentHeadRevisionId: string | null
  readonly disabled: boolean
  readonly onDownload: () => void
  readonly onGeneratePdf: () => void
  readonly onRefresh: () => void
  readonly onSetAvailability: (enabled: boolean) => void
  readonly pendingAction: CvPublicationPanelPendingAction
  readonly publication: CvPageState
}) => {
  const { artifact, link } = publication
  const earlierRevision =
    currentHeadRevisionId !== null &&
    currentHeadRevisionId !== link.currentRevisionId
  const controlsDisabled = disabled || pendingAction !== null
  const pdfStatus = artifact?.status ?? 'missing'

  return (
    <div className="mt-4 grid gap-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={link.enabled ? 'secondary' : 'outline'}>
          {link.enabled ? 'Page is public' : 'Private draft'}
        </Badge>
        <Badge variant={pdfStatus === 'ready' ? 'secondary' : 'outline'}>
          {pdfStatus === 'missing'
            ? 'PDF not generated'
            : pdfStatus === 'pending'
              ? 'PDF generating'
              : pdfStatus === 'ready'
                ? 'PDF ready'
                : 'PDF generation failed'}
        </Badge>
        {earlierRevision ? (
          <Badge variant="outline">Preview uses an earlier revision</Badge>
        ) : null}
        {!link.enabled && link.disabledReason ? (
          <span className="text-xs text-muted-foreground">
            {link.disabledReason}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={controlsDisabled}
          onClick={onRefresh}
        >
          <RefreshCw />
          {pendingAction === 'refresh' ? 'Refreshing…' : 'Refresh status'}
        </Button>
        {link.enabled ? (
          <a
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            href={link.publicUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open published CV <ExternalLink className="size-4" />
          </a>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={controlsDisabled || pdfStatus !== 'ready'}
          onClick={onDownload}
        >
          <Download />
          {pendingAction === 'download' ? 'Downloading…' : 'Download PDF'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={controlsDisabled || pdfStatus === 'pending'}
          onClick={onGeneratePdf}
        >
          <RefreshCw />
          {pendingAction === 'pdf'
            ? 'Starting…'
            : pdfStatus === 'missing'
              ? 'Generate PDF'
              : 'Regenerate PDF'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={controlsDisabled}
          onClick={() => onSetAvailability(!link.enabled)}
        >
          {link.enabled ? <EyeOff /> : <ExternalLink />}
          {pendingAction === 'availability'
            ? link.enabled
              ? 'Disabling…'
              : 'Enabling…'
            : link.enabled
              ? 'Make page private'
              : 'Make page public'}
        </Button>
      </div>
      {artifact?.status === 'failed' && artifact.errorMessage ? (
        <p className="text-sm text-destructive">{artifact.errorMessage}</p>
      ) : null}
    </div>
  )
}
