import type { CvDocumentV1 } from '@cv/contracts/document'
import {
  CvDocumentV1Schema,
  cvDocumentV1ContractId,
  cvDocumentV1Version,
} from '@cv/contracts/document'
import {
  Alert,
  AlertDescription,
  AlertTitle,
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
import { type CvPageLayoutAssessment, cvRendererVersion } from '@cv/renderer'
import {
  createInitialValue,
  inspectSchema,
  validateSchemaValue,
} from '@cv/schema-editor/core'
import { RawJsonEditor, SchemaEditor } from '@cv/schema-editor/react'
import {
  Check,
  CircleAlert,
  Eye,
  RefreshCw,
  Save,
  Send,
  Sparkles,
} from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router'

import { generateChatGptJson } from '../../ai'
import {
  appendContentRevision,
  approveContentRevision,
  buildAppendRevisionRequest,
  type ContentRevisionResult,
  type CvLink,
  publicCvBaseUrl,
  publishCv,
  readCurrentPdf,
  readPublishedCvState,
  setCvLinkAvailability,
  startPdfWorkflow,
  waitForPdfWorkflow,
} from '../../api'
import { decodeBase64Bytes } from '../../base64'
import { ChatGptAccess } from '../../components/chatgpt-access'
import { CvDocumentPreview } from '../../components/cv-document-preview'
import { CvPublicationPanel } from '../../components/cv-publication-panel'
import { JobContextEditor } from '../../components/job-context-editor'
import { ModelSelector } from '../../components/model-selector'
import { PreparationPageFrame } from '../../components/page-frame'
import {
  cvDocumentV1GuidanceItems,
  cvDocumentV1JsonSchema,
  cvDocumentV1ModelGuidance,
} from '../../document-contract'
import { messageFromCause, usePreparationBootstrap } from '../../hooks'
import { buildCvDraftGenerationRequest } from '../../prompts'
import {
  initialCvPublicationViewState,
  reduceCvPublicationViewState,
} from '../../publication-state'
import { useTransientAiSession } from '../../session'

const locale = 'en'

const issueSummary = (issues: ReadonlyArray<{ readonly message: string }>) =>
  issues.slice(0, 4).map((issue) => issue.message)

export const CvPreparationPage = () => {
  const { applicationId = '' } = useParams()
  const bootstrap = usePreparationBootstrap(applicationId, locale, 'cv')
  const aiSession = useTransientAiSession()
  const [authenticated, setAuthenticated] = React.useState(false)
  const [draft, setDraft] = React.useState<unknown>(() =>
    createInitialValue(inspectSchema(CvDocumentV1Schema).descriptor)
  )
  const [saved, setSaved] = React.useState<ContentRevisionResult | null>(null)
  const [approved, setApproved] = React.useState<ContentRevisionResult | null>(
    null
  )
  const [publicationView, dispatchPublicationView] = React.useReducer(
    reduceCvPublicationViewState,
    initialCvPublicationViewState
  )
  const publication = publicationView.publication
  const [previewPageLayout, setPreviewPageLayout] =
    React.useState<CvPageLayoutAssessment | null>(null)
  const [source, setSource] = React.useState<'ai' | 'human'>('human')
  const [dirty, setDirty] = React.useState(true)
  const [pending, setPending] = React.useState<
    | 'generate'
    | 'save'
    | 'approve'
    | 'publish'
    | 'download'
    | 'availability'
    | null
  >(null)
  const [error, setError] = React.useState<string | null>(null)
  const loadedHeadKey = React.useRef<string | null>(null)
  const validation = React.useMemo(
    () => validateSchemaValue(CvDocumentV1Schema, draft),
    [draft]
  )
  const selectedModel = aiSession.state.modelId
  const previewFitsOnePage =
    validation.valid && previewPageLayout?.status === 'fits'
  const previewPublicUrl =
    publication?.link.publicUrl ?? `${publicCvBaseUrl()}/${'0'.repeat(32)}`
  const publicationEntryId =
    bootstrap.status === 'ready' ? bootstrap.value.entry.id : null

  React.useEffect(() => {
    if (bootstrap.status !== 'ready') return
    const { entry, head } = bootstrap.value
    const key = `${entry.id}:${head?.revision.id ?? 'empty'}`
    if (loadedHeadKey.current === key) return
    loadedHeadKey.current = key
    if (head === null) return

    setDraft(head.value)
    setSaved(head)
    setApproved(
      head.entry.approvedRevisionId === head.revision.id ? head : null
    )
    setPreviewPageLayout(null)
    setSource('human')
    setDirty(false)
  }, [bootstrap])

  React.useEffect(() => {
    dispatchPublicationView({
      type: 'select-entry',
      entryId: publicationEntryId,
    })
    if (publicationEntryId === null) return

    let active = true
    readPublishedCvState(applicationId, publicationEntryId, cvRendererVersion)
      .then((loadedPublication) => {
        if (active) {
          dispatchPublicationView({
            type: 'publication-loaded',
            entryId: publicationEntryId,
            publication: loadedPublication,
          })
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            messageFromCause(
              cause,
              'The existing publication status could not be loaded.'
            )
          )
        }
      })
    return () => {
      active = false
    }
  }, [applicationId, publicationEntryId])

  const changeDraft = React.useCallback((value: unknown) => {
    setDraft(value)
    setSource('human')
    setDirty(true)
    setApproved(null)
    setPreviewPageLayout(null)
  }, [])

  const generate = async () => {
    if (bootstrap.status !== 'ready' || selectedModel === null) return
    setPending('generate')
    setError(null)
    const controller = new AbortController()
    try {
      const result = await generateChatGptJson<CvDocumentV1>({
        ...buildCvDraftGenerationRequest({
          factsCatalogue: bootstrap.value.context.factsCatalogue,
          guidance: cvDocumentV1ModelGuidance,
          jobContext: bootstrap.value.context.jobContext,
          locale,
          modelId: selectedModel,
          schema: cvDocumentV1JsonSchema,
        }),
        signal: controller.signal,
      })
      setDraft(result.output)
      setSource('ai')
      setDirty(true)
      setApproved(null)
      setPreviewPageLayout(null)
      aiSession.markGenerated('cv')
    } catch (cause) {
      setError(messageFromCause(cause, 'The CV draft could not be generated.'))
    } finally {
      setPending(null)
    }
  }

  const save = async () => {
    if (bootstrap.status !== 'ready' || !validation.valid) return
    setPending('save')
    setError(null)
    try {
      const entry = saved?.entry ?? bootstrap.value.entry
      const request = buildAppendRevisionRequest({
        contractId: cvDocumentV1ContractId,
        contractVersion: String(cvDocumentV1Version),
        entry,
        factsReleaseId: bootstrap.value.context.factsReleaseId,
        jobSnapshotId: bootstrap.value.context.jobSnapshot.id,
        operationId: crypto.randomUUID(),
        source,
        value: validation.value,
      })
      const result = await appendContentRevision(applicationId, entry, request)
      setSaved(result)
      setApproved(null)
      setDirty(false)
    } catch (cause) {
      setError(messageFromCause(cause, 'The CV revision could not be saved.'))
    } finally {
      setPending(null)
    }
  }

  const approve = async () => {
    if (saved === null || dirty || !previewFitsOnePage) return
    setPending('approve')
    setError(null)
    try {
      const result = await approveContentRevision(applicationId, saved)
      setSaved(result)
      setApproved(result)
    } catch (cause) {
      setError(
        messageFromCause(cause, 'The CV revision could not be approved.')
      )
    } finally {
      setPending(null)
    }
  }

  const publish = async () => {
    if (approved === null || !previewFitsOnePage) return
    setPending('publish')
    setError(null)
    let link: CvLink | null = null
    let workflowStarted = false
    try {
      link = await publishCv(applicationId, approved, publicCvBaseUrl())
      const workflow = await startPdfWorkflow(
        applicationId,
        approved.entry.id,
        link.publicationVersion,
        cvRendererVersion
      )
      workflowStarted = true
      await waitForPdfWorkflow(applicationId, approved.entry.id, workflow)
      const published = await readPublishedCvState(
        applicationId,
        approved.entry.id,
        cvRendererVersion
      )
      if (
        published === null ||
        published.link.publicationVersion !== link.publicationVersion ||
        published.artifact.contentRevisionId !== approved.revision.id
      ) {
        throw new Error(
          'PDF Workflow completed without a current artifact for this publication.'
        )
      }
      dispatchPublicationView({
        type: 'publication-loaded',
        entryId: approved.entry.id,
        publication: published,
      })
      aiSession.complete()
    } catch (cause) {
      if (link !== null && !workflowStarted) {
        await setCvLinkAvailability(applicationId, approved.entry.id, {
          enabled: false,
          expectedPublicationVersion: link.publicationVersion,
          reason: 'PDF generation could not be started.',
        }).catch(() => undefined)
      }
      setError(
        messageFromCause(
          cause,
          'The approved CV or its PDF could not be published.'
        )
      )
    } finally {
      setPending(null)
    }
  }

  const downloadPdf = async () => {
    if (publication === null) return
    setPending('download')
    setError(null)
    try {
      const ready = await readCurrentPdf(
        applicationId,
        publication.link.contentEntryId,
        cvRendererVersion
      )
      const blob = new Blob([decodeBase64Bytes(ready.payload.data)], {
        type: ready.payload.mediaType,
      })
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `cv-${publication.link.token}.pdf`
      anchor.click()
      URL.revokeObjectURL(objectUrl)
    } catch (cause) {
      setError(
        messageFromCause(cause, 'The stored PDF could not be downloaded.')
      )
    } finally {
      setPending(null)
    }
  }

  const setPublicationAvailability = async (enabled: boolean) => {
    if (publication === null) return
    setPending('availability')
    setError(null)
    try {
      const link = await setCvLinkAvailability(
        applicationId,
        publication.link.contentEntryId,
        {
          enabled,
          expectedPublicationVersion: publication.link.publicationVersion,
          ...(!enabled
            ? { reason: 'Disabled manually from CV preparation.' }
            : {}),
        }
      )
      dispatchPublicationView({ type: 'link-updated', link })
    } catch (cause) {
      setError(
        messageFromCause(
          cause,
          enabled
            ? 'The public CV link could not be enabled.'
            : 'The public CV link could not be disabled.'
        )
      )
    } finally {
      setPending(null)
    }
  }

  return (
    <PreparationPageFrame
      applicationId={applicationId}
      eyebrow="Application preparation"
      title="Tailor the CV"
      description="Generate from the latest job snapshot and active reviewed facts, then inspect, edit, save, preview, approve, and publish one schema-valid revision."
    >
      {bootstrap.status === 'error' ? (
        <>
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Preparation context unavailable</AlertTitle>
            <AlertDescription className="grid gap-3">
              <span>{bootstrap.message}</span>
              <Button
                className="w-fit"
                variant="outline"
                disabled={bootstrap.snapshotRefreshPending}
                onClick={bootstrap.refreshJobSnapshot}
              >
                <RefreshCw />
                {bootstrap.snapshotRefreshPending
                  ? 'Refreshing posting…'
                  : 'Capture posting again'}
              </Button>
            </AlertDescription>
          </Alert>
          <JobContextEditor
            applicationId={applicationId}
            onSaved={bootstrap.reloadPreparationContext}
          />
        </>
      ) : bootstrap.status === 'loading' ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading the job snapshot, active facts release, and draft entry…
          </CardContent>
        </Card>
      ) : (
        <>
          <JobContextEditor
            applicationId={applicationId}
            initialContext={bootstrap.value.context.jobContext}
            onSaved={bootstrap.reloadPreparationContext}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <ChatGptAccess onAuthenticationChange={setAuthenticated} />
            <Card>
              <CardHeader>
                <CardTitle>Generation context</CardTitle>
                <CardDescription>
                  The browser validates both inputs before sending a one-shot
                  request.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    Snapshot {bootstrap.value.context.jobSnapshot.id}
                  </Badge>
                  <Badge variant="outline">
                    Facts {bootstrap.value.context.factsReleaseId}
                  </Badge>
                  <Badge variant="outline">Locale {locale}</Badge>
                  <Badge variant="outline">
                    {cvDocumentV1GuidanceItems.length} guidance rules
                  </Badge>
                </div>
                <Button
                  className="w-fit"
                  variant="outline"
                  disabled={
                    pending !== null || bootstrap.snapshotRefreshPending
                  }
                  onClick={bootstrap.refreshJobSnapshot}
                >
                  <RefreshCw />
                  {bootstrap.snapshotRefreshPending
                    ? 'Refreshing posting…'
                    : 'Refresh job posting'}
                </Button>
                <ModelSelector
                  authenticated={authenticated}
                  value={selectedModel}
                  onChange={aiSession.selectModel}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      pending !== null ||
                      !authenticated ||
                      selectedModel === null
                    }
                    onClick={() => void generate()}
                  >
                    <Sparkles />
                    {pending === 'generate' ? 'Generating…' : 'Generate draft'}
                  </Button>
                  <Link
                    to="/schema/cv-document"
                    className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
                  >
                    Inspect schema guidance
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Preparation step failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.85fr)]">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Document editor</CardTitle>
                    <CardDescription className="mt-1">
                      Controls are derived from the imported Effect schema at
                      runtime. Raw JSON remains available for every document.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={validation.valid ? 'secondary' : 'danger'}>
                      {validation.valid ? 'Schema valid' : 'Needs attention'}
                    </Badge>
                    <Badge
                      variant={
                        previewPageLayout?.status === 'overflow'
                          ? 'danger'
                          : previewFitsOnePage
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {previewPageLayout?.status === 'overflow'
                        ? 'A4 overflow'
                        : previewFitsOnePage
                          ? 'One A4 page'
                          : 'Measuring A4'}
                    </Badge>
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
                      schema={CvDocumentV1Schema}
                      value={draft}
                      onChange={changeDraft}
                      disabled={pending !== null}
                    />
                  </TabsContent>
                  <TabsContent value="raw" className="mt-4">
                    <RawJsonEditor
                      label="CV document JSON"
                      description="Edits are validated against the same code-owned contract."
                      value={draft}
                      onChange={changeDraft}
                      disabled={pending !== null}
                      issues={
                        validation.valid ? [] : issueSummary(validation.issues)
                      }
                    />
                  </TabsContent>
                </Tabs>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    disabled={pending !== null || !validation.valid || !dirty}
                    onClick={() => void save()}
                  >
                    <Save />
                    {pending === 'save' ? 'Saving…' : 'Save revision'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      pending !== null ||
                      saved === null ||
                      dirty ||
                      !previewFitsOnePage
                    }
                    onClick={() => void approve()}
                  >
                    <Check />
                    {pending === 'approve' ? 'Approving…' : 'Approve revision'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      pending !== null ||
                      approved === null ||
                      !previewFitsOnePage
                    }
                    onClick={() => void publish()}
                  >
                    <Send />
                    {pending === 'publish' ? 'Publishing…' : 'Publish CV'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="h-fit xl:sticky xl:top-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="size-4" />
                  Internal preview
                </CardTitle>
                <CardDescription>
                  The browser uses the same renderer and A4 layout as the public
                  Worker. Unsaved draft data never becomes public.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {validation.valid ? (
                  <CvDocumentPreview
                    document={validation.value}
                    onPageLayoutChange={setPreviewPageLayout}
                    publicUrl={previewPublicUrl}
                  />
                ) : (
                  <div className="grid min-h-80 place-items-center rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Fix the schema issues to render a live preview.
                  </div>
                )}
                {publication ? (
                  <CvPublicationPanel
                    currentHeadRevisionId={saved?.revision.id ?? null}
                    disabled={pending !== null}
                    publication={publication}
                    pendingAction={
                      pending === 'download' || pending === 'availability'
                        ? pending
                        : null
                    }
                    onDownload={() => void downloadPdf()}
                    onSetAvailability={(enabled) =>
                      void setPublicationAvailability(enabled)
                    }
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PreparationPageFrame>
  )
}
