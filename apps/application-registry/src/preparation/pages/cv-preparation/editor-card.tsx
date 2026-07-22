import { CvDocumentV1Schema } from '@cv/contracts/document'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@cv/internal-ui'
import { RawJsonEditor, SchemaEditor } from '@cv/schema-editor/react'
import {
  ArrowRight,
  Ban,
  Check,
  CircleAlert,
  Save,
  Send,
  X,
} from 'lucide-react'
import { Link } from 'react-router'

import type { PreparationWorkspace } from '@/preparation/workspace/atoms'
import type { CvPreparationActions } from './actions'

const issueSummary = (issues: ReadonlyArray<{ readonly message: string }>) =>
  issues.slice(0, 4).map((issue) => issue.message)

export const CvEditorCard = ({
  actions,
  presentation = 'preparation',
  publicationHref,
  workspace,
}: {
  readonly actions: CvPreparationActions
  readonly presentation?: 'preparation' | 'review'
  readonly publicationHref?: string
  readonly workspace: PreparationWorkspace
}) => {
  const { editor, run } = workspace
  const detachedCandidate =
    editor.workflowCandidate._tag === 'Detached'
      ? editor.workflowCandidate
      : null
  const detachedExplanation =
    detachedCandidate?.reason === 'review-rejected'
      ? 'The Workflow review for this saved AI candidate was rejected.'
      : detachedCandidate?.reason === 'workflow-cancelled'
        ? 'The Workflow that produced this saved AI candidate was cancelled after the revision was saved.'
        : detachedCandidate?.reason === 'workflow-failed'
          ? 'The Workflow that produced this saved AI candidate failed after the revision was saved.'
          : 'The live Workflow review is no longer available in this browser session.'

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Document editor</CardTitle>
            <CardDescription className="mt-1">
              Controls come from the code-owned Effect schema. Raw JSON remains
              available for the entire document.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={editor.validation.valid ? 'secondary' : 'danger'}>
              {editor.validation.valid ? 'Schema valid' : 'Needs attention'}
            </Badge>
            {editor.isApproved ? (
              <Badge variant="secondary">Approved</Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {detachedCandidate === null ? null : (
          <Alert className="mb-4">
            <CircleAlert />
            <AlertTitle>Saved candidate needs an approval decision</AlertTitle>
            <AlertDescription className="grid gap-3">
              <span>
                {detachedExplanation} Release the Workflow gate only if you
                intend to treat this unchanged AI revision as a direct approval
                candidate.
              </span>
              <Button
                className="w-fit"
                disabled={actions.commandPending || actions.workflowExecuting}
                size="sm"
                variant="outline"
                onClick={actions.releaseDetachedCandidate}
              >
                Allow direct approval
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <Tabs defaultValue="structured">
          <TabsList>
            <TabsTrigger value="structured">Structured</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="structured" className="mt-4">
            <SchemaEditor
              schema={CvDocumentV1Schema}
              value={editor.document}
              onChange={actions.changeDraft}
              disabled={actions.commandPending || actions.workflowExecuting}
            />
          </TabsContent>
          <TabsContent value="raw" className="mt-4">
            <RawJsonEditor
              label="CV document JSON"
              description="Edits are validated against the same code-owned contract."
              value={editor.document}
              onChange={actions.changeDraft}
              disabled={actions.commandPending || actions.workflowExecuting}
              issues={
                editor.validation.valid
                  ? []
                  : issueSummary(editor.validation.issues)
              }
            />
          </TabsContent>
        </Tabs>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button
            disabled={actions.commandPending || !editor.canSave}
            onClick={() => void actions.save()}
          >
            <Save />
            {actions.saving ? 'Saving…' : 'Save revision'}
          </Button>
          <Button
            variant="outline"
            disabled={actions.commandPending || !actions.canApprove}
            onClick={() => void actions.approve()}
          >
            <Check />
            {actions.approving || actions.reviewPending
              ? 'Approving…'
              : editor.approvalMode === 'workflow'
                ? 'Approve workflow candidate'
                : 'Approve revision'}
          </Button>
          {run?.status !== 'awaiting_review' ? null : (
            <Button
              variant="outline"
              disabled={actions.commandPending}
              onClick={() => void actions.reject()}
            >
              <X />
              {actions.reviewPending
                ? 'Submitting review…'
                : 'Reject workflow candidate'}
            </Button>
          )}
          {presentation === 'review' ? (
            actions.approvedRevision === null ||
            publicationHref === undefined ? null : (
              <Link
                to={publicationHref}
                className={cn(buttonVariants({ variant: 'default' }))}
              >
                Continue to publication
                <ArrowRight />
              </Link>
            )
          ) : (
            <Button
              variant="outline"
              disabled={
                actions.commandPending ||
                actions.publicationExecuting ||
                actions.approvedRevision === null ||
                actions.publication === null ||
                actions.publication.link.enabled
              }
              onClick={() => void actions.publish()}
            >
              <Send />
              {actions.publishing ? 'Publishing…' : 'Publish CV'}
            </Button>
          )}
          {presentation === 'review' ||
          !actions.publicationExecuting ||
          actions.publicationRun === null ? null : (
            <Button
              variant="outline"
              disabled={actions.commandPending}
              onClick={() => void actions.cancelPublishing()}
            >
              <Ban />
              {actions.cancellingPublication
                ? 'Cancelling publication…'
                : 'Cancel publication'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
