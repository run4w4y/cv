import { Badge, Button } from '@cv/internal-ui'
import { Download, ExternalLink, EyeOff, RefreshCw } from 'lucide-react'

import type { PublishedCvState } from '../api'

export type CvPublicationPanelPendingAction = 'availability' | 'download' | null

export const CvPublicationPanel = ({
  currentHeadRevisionId,
  disabled,
  onDownload,
  onSetAvailability,
  pendingAction,
  publication,
}: {
  readonly currentHeadRevisionId: string | null
  readonly disabled: boolean
  readonly onDownload: () => void
  readonly onSetAvailability: (enabled: boolean) => void
  readonly pendingAction: CvPublicationPanelPendingAction
  readonly publication: PublishedCvState
}) => {
  const { artifact, link } = publication
  const earlierRevision =
    currentHeadRevisionId !== null &&
    currentHeadRevisionId !== artifact.contentRevisionId
  const controlsDisabled = disabled || pendingAction !== null

  return (
    <div className="mt-4 grid gap-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={link.enabled ? 'secondary' : 'outline'}>
          {link.enabled ? 'Public link enabled' : 'Public link disabled'}
        </Badge>
        {earlierRevision ? (
          <Badge variant="outline">Earlier revision remains published</Badge>
        ) : null}
        {!link.enabled && link.disabledReason ? (
          <span className="text-xs text-muted-foreground">
            {link.disabledReason}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
          disabled={controlsDisabled}
          onClick={onDownload}
        >
          <Download />
          {pendingAction === 'download' ? 'Downloading…' : 'Download PDF'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={controlsDisabled}
          onClick={() => onSetAvailability(!link.enabled)}
        >
          {link.enabled ? <EyeOff /> : <RefreshCw />}
          {pendingAction === 'availability'
            ? link.enabled
              ? 'Disabling…'
              : 'Enabling…'
            : link.enabled
              ? 'Disable public link'
              : 'Enable public link'}
        </Button>
      </div>
    </div>
  )
}
