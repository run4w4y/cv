import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@cv/internal-ui'
import { RawJsonEditor, SchemaEditor } from '@cv/schema-editor/react'
import { Check, Save, X } from 'lucide-react'

import { CoverLetterDocumentSchema } from '../../cover-letter-contract'
import type {
  CoverLetterPageController,
  CoverLetterWorkspace,
} from './use-page-controller'

const approvalLabel = (
  page: CoverLetterPageController,
  workspace: CoverLetterWorkspace
): string => {
  if (workspace.editor.approvalMode === 'workflow') {
    return page.reviewPending ? 'Submitting decision…' : 'Approve letter'
  }
  return page.approvePending ? 'Approving…' : 'Approve letter'
}

export const CoverLetterEditorCard = ({
  page,
  workspace,
}: {
  readonly page: CoverLetterPageController
  readonly workspace: CoverLetterWorkspace
}) => {
  const { editor, run } = workspace
  const editorDisabled = page.actionPending || page.workflowExecuting
  const approvalPending =
    editor.approvalMode === 'workflow'
      ? page.reviewPending
      : page.approvePending

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Cover-letter editor</CardTitle>
            <CardDescription className="mt-1">
              The same generic schema editor and raw JSON fallback are used here
              without backend knowledge of the payload.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant={editor.validation.valid ? 'secondary' : 'danger'}>
              {editor.validation.valid ? 'Schema valid' : 'Needs attention'}
            </Badge>
            {editor.baseRevision !== null && !editor.dirty ? (
              <Badge variant="outline">Saved</Badge>
            ) : null}
            {editor.isApproved ? (
              <Badge variant="secondary">Approved</Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="structured">
          <TabsList>
            <TabsTrigger value="structured">Structured</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="structured" className="mt-4">
            <SchemaEditor
              schema={CoverLetterDocumentSchema}
              value={editor.document}
              onChange={page.changeDraft}
              disabled={editorDisabled}
            />
          </TabsContent>
          <TabsContent value="raw" className="mt-4">
            <RawJsonEditor
              label="Cover-letter JSON"
              value={editor.document}
              onChange={page.changeDraft}
              disabled={editorDisabled}
              issues={
                editor.validation.valid
                  ? []
                  : editor.validation.issues
                      .slice(0, 4)
                      .map((issue) => issue.message)
              }
            />
          </TabsContent>
        </Tabs>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button
            disabled={
              page.actionPending || page.workflowExecuting || !editor.canSave
            }
            onClick={() => void page.save()}
          >
            <Save />
            {page.savePending ? 'Saving…' : 'Save cover letter'}
          </Button>
          <Button
            variant="outline"
            disabled={
              page.actionPending ||
              page.workflowExecuting ||
              !editor.canApprove ||
              !page.workflowReviewBound
            }
            onClick={() => void page.approve()}
          >
            <Check />
            {approvalLabel(page, workspace)}
          </Button>
          {run?.status !== 'awaiting_review' ? null : (
            <Button
              variant="outline"
              disabled={page.actionPending || approvalPending}
              onClick={() => void page.reject()}
            >
              <X />
              {page.reviewPending
                ? 'Submitting decision…'
                : 'Reject Workflow candidate'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
