import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cv/internal-ui'
import { Eye } from 'lucide-react'

import { CvDocumentPreview } from '@/preparation/components/cv-document-preview'
import { CvPublicationPanel } from '@/preparation/components/cv-publication-panel'
import type { PreparationWorkspace } from '@/preparation/workspace/atoms'
import type { CvPreparationActions } from './actions'

export const CvPreviewCard = ({
  actions,
  workspace,
}: {
  readonly actions: CvPreparationActions
  readonly workspace: PreparationWorkspace
}) => {
  return (
    <Card className="h-fit xl:sticky xl:top-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-4" />
          Internal preview
        </CardTitle>
        <CardDescription>
          Saving a revision stages it as a private page. This is the same stored
          document and renderer used by the public page and PDF worker.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {actions.publication === null ? (
          <div className="grid min-h-80 place-items-center rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Save a valid CV revision to create its private preview.
          </div>
        ) : (
          <CvDocumentPreview link={actions.publication.link} />
        )}
        {actions.publication === null ? null : (
          <CvPublicationPanel
            currentHeadRevisionId={
              workspace.editor.baseRevision?.revision.id ?? null
            }
            disabled={actions.commandPending}
            publication={actions.publication}
            pendingAction={
              actions.downloading
                ? 'download'
                : actions.refreshingPublication
                  ? 'refresh'
                  : actions.generatingPdf
                    ? 'pdf'
                    : actions.changingAvailability
                      ? 'availability'
                      : null
            }
            onDownload={() => void actions.downloadPdf()}
            onGeneratePdf={() => void actions.generatePdf()}
            onRefresh={() => void actions.refreshPublication()}
            onSetAvailability={(enabled) =>
              void actions.setPublicationAvailability(enabled)
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
