import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from '@cv/internal-ui'
import { Eye } from 'lucide-react'

import { CvDocumentPreview } from '@/preparation/components/cv-document-preview'
import { CvPublicationPanel } from '@/preparation/components/cv-publication-panel'
import type { PreparationWorkspace } from '@/preparation/workspace/atoms'
import type { CvPreparationActions } from './actions'

export const CvPreviewCard = ({
  actions,
  presentation = 'preparation',
  workspace,
}: {
  readonly actions: CvPreparationActions
  readonly presentation?: 'preparation' | 'publication' | 'review'
  readonly workspace: PreparationWorkspace
}) => {
  return (
    <Card
      className={cn(
        'h-fit',
        presentation !== 'publication' && 'xl:sticky xl:top-0'
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-4" />
          {presentation === 'publication'
            ? 'Publication preview'
            : presentation === 'review'
              ? 'Candidate preview'
              : 'Internal preview'}
        </CardTitle>
        <CardDescription>
          {presentation === 'publication'
            ? 'Inspect the exact staged document, then manage its PDF artifact and public availability.'
            : presentation === 'review'
              ? 'Compare the rendered candidate with the editable document before making the approval decision.'
              : 'Saving a revision stages it as a private page. This is the same stored document and renderer used by the public page and PDF worker.'}
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
        {actions.publication === null || presentation === 'review' ? null : (
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
