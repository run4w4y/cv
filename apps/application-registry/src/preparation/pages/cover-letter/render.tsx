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
  Field,
  FieldDescription,
  FieldLabel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@cv/internal-ui'
import { validateSchemaValue } from '@cv/schema-editor/core'
import { RawJsonEditor, SchemaEditor } from '@cv/schema-editor/react'
import { CircleAlert, RefreshCw, Save, Sparkles } from 'lucide-react'
import * as React from 'react'
import { useParams } from 'react-router'

import { generateChatGptJson } from '../../ai'
import {
  appendContentRevision,
  buildAppendRevisionRequest,
  type ContentRevisionResult,
} from '../../api'
import { ChatGptAccess } from '../../components/chatgpt-access'
import { JobContextEditor } from '../../components/job-context-editor'
import { ModelSelector } from '../../components/model-selector'
import { PreparationPageFrame } from '../../components/page-frame'
import {
  type CoverLetterDocument,
  CoverLetterDocumentSchema,
  coverLetterContractId,
  coverLetterContractVersion,
  coverLetterJsonSchema,
  initialCoverLetterDocument,
} from '../../cover-letter-contract'
import { messageFromCause, usePreparationBootstrap } from '../../hooks'
import { buildCoverLetterGenerationRequest } from '../../prompts'
import { useTransientAiSession } from '../../session'

const locale = 'en'
const initialPrompt =
  'Write a direct, concise letter that explains why my verified experience is relevant. Avoid generic enthusiasm, clichés, and claims not present in the facts catalogue.'

export const CoverLetterPage = () => {
  const { applicationId = '' } = useParams()
  const bootstrap = usePreparationBootstrap(
    applicationId,
    locale,
    'cover_letter'
  )
  const aiSession = useTransientAiSession()
  const [authenticated, setAuthenticated] = React.useState(false)
  const [prompt, setPrompt] = React.useState(initialPrompt)
  const [draft, setDraft] = React.useState<unknown>(() =>
    initialCoverLetterDocument(locale)
  )
  const [saved, setSaved] = React.useState<ContentRevisionResult | null>(null)
  const [source, setSource] = React.useState<'ai' | 'human'>('human')
  const [dirty, setDirty] = React.useState(true)
  const [pending, setPending] = React.useState<'generate' | 'save' | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const loadedHeadKey = React.useRef<string | null>(null)
  const selectedModel = aiSession.state.modelId

  React.useEffect(() => {
    if (bootstrap.status !== 'ready') return
    const { entry, head } = bootstrap.value
    const key = `${entry.id}:${head?.revision.id ?? 'empty'}`
    if (loadedHeadKey.current === key) return
    loadedHeadKey.current = key
    if (head === null) return

    setDraft(head.value)
    setSaved(head)
    setSource('human')
    setDirty(false)
  }, [bootstrap])
  const validation = React.useMemo(
    () => validateSchemaValue(CoverLetterDocumentSchema, draft),
    [draft]
  )

  const changeDraft = React.useCallback((value: unknown) => {
    setDraft(value)
    setSource('human')
    setDirty(true)
  }, [])

  const generate = async () => {
    if (bootstrap.status !== 'ready' || selectedModel === null) return
    setPending('generate')
    setError(null)
    try {
      const result = await generateChatGptJson<CoverLetterDocument>(
        buildCoverLetterGenerationRequest({
          factsCatalogue: bootstrap.value.context.factsCatalogue,
          jobContext: bootstrap.value.context.jobContext,
          locale,
          modelId: selectedModel,
          prompt,
          schema: coverLetterJsonSchema,
        })
      )
      setDraft(result.output)
      setSource('ai')
      setDirty(true)
      aiSession.markGenerated('cover-letter')
    } catch (cause) {
      setError(
        messageFromCause(cause, 'The cover letter could not be generated.')
      )
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
      const result = await appendContentRevision(
        applicationId,
        entry,
        buildAppendRevisionRequest({
          contractId: coverLetterContractId,
          contractVersion: coverLetterContractVersion,
          entry,
          factsReleaseId: bootstrap.value.context.factsReleaseId,
          jobSnapshotId: bootstrap.value.context.jobSnapshot.id,
          operationId: crypto.randomUUID(),
          source,
          value: validation.value,
        })
      )
      setSaved(result)
      setDirty(false)
      aiSession.complete()
    } catch (cause) {
      setError(
        messageFromCause(cause, 'The cover-letter revision could not be saved.')
      )
    } finally {
      setPending(null)
    }
  }

  return (
    <PreparationPageFrame
      applicationId={applicationId}
      eyebrow="Separate writing flow"
      title="Prepare a cover letter"
      description="Customize the writing instructions, generate from the same job snapshot and reviewed facts, edit the result, and store it as an opaque cover-letter revision."
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
            Loading the role context and active facts release…
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
                <CardTitle>Generation settings</CardTitle>
                <CardDescription>
                  This prompt belongs only to this cover-letter request and is
                  never stored as an AI conversation.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    Snapshot {bootstrap.value.context.jobSnapshot.id}
                  </Badge>
                  <Button
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
                </div>
                <ModelSelector
                  authenticated={authenticated}
                  value={selectedModel}
                  onChange={aiSession.selectModel}
                />
                <Field>
                  <FieldLabel htmlFor="cover-letter-prompt">
                    Writing instructions
                  </FieldLabel>
                  <FieldDescription>
                    Adjust tone, emphasis, and length for this application.
                  </FieldDescription>
                  <Textarea
                    id="cover-letter-prompt"
                    className="min-h-32"
                    value={prompt}
                    onChange={(event) => setPrompt(event.currentTarget.value)}
                  />
                </Field>
                <Button
                  className="w-fit"
                  disabled={
                    pending !== null ||
                    !authenticated ||
                    selectedModel === null ||
                    prompt.trim().length === 0
                  }
                  onClick={() => void generate()}
                >
                  <Sparkles />
                  {pending === 'generate' ? 'Generating…' : 'Generate letter'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Cover-letter step failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Cover-letter editor</CardTitle>
                  <CardDescription className="mt-1">
                    The same generic schema editor and raw JSON fallback are
                    used here without backend knowledge of the payload.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant={validation.valid ? 'secondary' : 'danger'}>
                    {validation.valid ? 'Schema valid' : 'Needs attention'}
                  </Badge>
                  {saved && !dirty ? (
                    <Badge variant="outline">Saved</Badge>
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
                    value={draft}
                    onChange={changeDraft}
                    disabled={pending !== null}
                  />
                </TabsContent>
                <TabsContent value="raw" className="mt-4">
                  <RawJsonEditor
                    label="Cover-letter JSON"
                    value={draft}
                    onChange={changeDraft}
                    disabled={pending !== null}
                    issues={
                      validation.valid
                        ? []
                        : validation.issues
                            .slice(0, 4)
                            .map((issue) => issue.message)
                    }
                  />
                </TabsContent>
              </Tabs>
              <div className="mt-5 border-t border-border pt-4">
                <Button
                  disabled={pending !== null || !validation.valid || !dirty}
                  onClick={() => void save()}
                >
                  <Save />
                  {pending === 'save' ? 'Saving…' : 'Save cover letter'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </PreparationPageFrame>
  )
}
