import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cv/internal-ui'
import { Eye } from 'lucide-react'

import { CvDocumentPreview } from '../../components/cv-document-preview'
import { CvPublicationPanel } from '../../components/cv-publication-panel'
import { publicCvBaseUrl } from '../../config'
import type { PreparationWorkspace } from '../../workspace/atoms'
import type { CvPreparationActions } from './actions'

export const CvPreviewCard = ({
  actions,
  workspace,
}: {
  readonly actions: CvPreparationActions
  readonly workspace: PreparationWorkspace
}) => {
  const publicUrl =
    actions.publication?.link.publicUrl ??
    `${publicCvBaseUrl()}/${'0'.repeat(32)}`

  return (
    <Card className="h-fit xl:sticky xl:top-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-4" />
          Internal preview
        </CardTitle>
        <CardDescription>
          The browser uses the same renderer and A4 layout as the public Worker.
          Unsaved draft data never becomes public.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {actions.document === null ? (
          <div className="grid min-h-80 place-items-center rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Fix the schema issues to render a live preview.
          </div>
        ) : (
          <CvDocumentPreview
            document={actions.document}
            onPageLayoutChange={actions.changeLayout}
            publicUrl={publicUrl}
          />
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
                : actions.changingAvailability
                  ? 'availability'
                  : null
            }
            onDownload={() => void actions.downloadPdf()}
            onSetAvailability={(enabled) =>
              void actions.setPublicationAvailability(enabled)
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
