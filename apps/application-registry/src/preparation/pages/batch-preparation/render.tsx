import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea,
} from '@cv/internal-ui'
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { CircleAlert, GitBranch, Layers3, Sparkles } from 'lucide-react'
import { asyncResultFailureMessage } from '../../async-result'
import { chatGptAuthenticatedAtom } from '../../auth/atoms'
import {
  batchPreparationCommandGateAtom,
  batchPreparationFormAtom,
  batchPreparationValidationAtom,
} from '../../batch/atoms'
import { ChatGptAccess } from '../../components/chatgpt-access'
import { ModelSelector } from '../../components/model-selector'
import { selectedPreparationModelAtom } from '../../forms/atoms'
import {
  preparationRunsAtom,
  startPreparationBatchAtom,
} from '../../workflow/atoms'
import { maximumPreparationBatchSize } from '../../workflow/domain'
import { PreparationRunCard } from './run-card'

export const BatchPreparationPage = () => {
  const [selectedModel, selectModel] = useAtom(selectedPreparationModelAtom)
  const authenticated = useAtomValue(chatGptAuthenticatedAtom)
  const [form, setForm] = useAtom(batchPreparationFormAtom)
  const { kind, locale, prompt, urls } = form
  const batchValidation = useAtomValue(batchPreparationValidationAtom)
  const [startResult, startBatch] = useAtom(startPreparationBatchAtom, {
    mode: 'promise',
  })
  const resetStartResult = useAtomSet(startPreparationBatchAtom)
  const [commandExecuting, setCommandExecuting] = useAtom(
    batchPreparationCommandGateAtom
  )
  const starting = commandExecuting || AsyncResult.isWaiting(startResult)
  const error = asyncResultFailureMessage(
    startResult,
    'The URL batch could not be started.'
  )
  const runsResult = useAtomValue(preparationRunsAtom)
  const runs =
    runsResult._tag === 'Success'
      ? [...runsResult.value.values()].reverse()
      : []
  const parsedUrls = batchValidation.urls
  const batchTooLarge = batchValidation.tooLarge

  const start = async () => {
    if (!authenticated || selectedModel === null || !batchValidation.canStart) {
      return
    }
    let claimed = false
    setCommandExecuting((current) => {
      if (current) return current
      claimed = true
      return true
    })
    if (!claimed) return
    resetStartResult(Atom.Reset)
    try {
      await startBatch({
        coverLetterPrompt: kind === 'cover_letter' ? prompt : null,
        kind,
        locale: locale.trim(),
        modelId: selectedModel,
        urls: parsedUrls,
      })
      setForm((current) => ({ ...current, urls: '' }))
    } catch {
      // The mutation atom retains the typed failure rendered below.
    } finally {
      setCommandExecuting(false)
    }
  }

  return (
    <main className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto grid w-full max-w-6xl gap-6 p-4 lg:p-8">
        <div className="grid gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="size-4" />
            Local Effect Workflow
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Process job URLs in parallel
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Each URL becomes its own in-memory workflow. Up to three jobs move
            forward concurrently, AI calls are globally limited to two, and
            every generated candidate is saved before its workflow waits for
            human review.
          </p>
        </div>

        <Alert>
          <Layers3 />
          <AlertTitle>Session-scoped by design</AlertTitle>
          <AlertDescription>
            Refreshing, closing this tab, or HMR discards workflow execution
            state. Candidate revisions already saved by the API remain in the
            application registry.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChatGptAccess />
          <Card>
            <CardHeader>
              <CardTitle>Batch settings</CardTitle>
              <CardDescription>
                One absolute HTTP(S) URL per line, up to{' '}
                {maximumPreparationBatchSize}. Duplicate URLs are removed.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="grid gap-2 text-sm" htmlFor="workflow-kind">
                <span className="font-medium">Document</span>
                <select
                  id="workflow-kind"
                  className="h-9 rounded-md border border-input bg-background px-3"
                  value={kind}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    if (value === 'cv' || value === 'cover_letter') {
                      setForm((current) => ({ ...current, kind: value }))
                    }
                  }}
                >
                  <option value="cv">Tailored CV</option>
                  <option value="cover_letter">Cover letter</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm" htmlFor="workflow-locale">
                <span className="font-medium">Facts locale</span>
                <input
                  id="workflow-locale"
                  className="h-9 rounded-md border border-input bg-background px-3"
                  value={locale}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      locale: event.currentTarget.value,
                    }))
                  }
                />
              </label>
              <ModelSelector
                authenticated={authenticated}
                value={selectedModel}
                onChange={selectModel}
              />
              {kind !== 'cover_letter' ? null : (
                <label className="grid gap-2 text-sm" htmlFor="workflow-prompt">
                  <span className="font-medium">Writing instructions</span>
                  <Textarea
                    id="workflow-prompt"
                    value={prompt}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        prompt: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Job URLs</CardTitle>
            <CardDescription>
              The Worker performs the CORS-safe capture; all orchestration,
              branching, batching, and review state stays in this frontend.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Textarea
              aria-label="Job URLs"
              className="min-h-40 font-mono text-sm"
              placeholder={
                'https://company.example/jobs/123\nhttps://another.example/careers/role'
              }
              value={urls}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  urls: event.currentTarget.value,
                }))
              }
            />
            {error === null ? null : (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Batch could not start</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!batchTooLarge ? null : (
              <p className="text-sm text-destructive">
                Remove {parsedUrls.length - maximumPreparationBatchSize} URL
                {parsedUrls.length - maximumPreparationBatchSize === 1
                  ? ''
                  : 's'}{' '}
                to stay within the {maximumPreparationBatchSize}-URL session
                limit.
              </p>
            )}
            <Button
              className="w-fit"
              disabled={
                starting ||
                !authenticated ||
                selectedModel === null ||
                parsedUrls.length === 0 ||
                batchTooLarge ||
                locale.trim().length === 0 ||
                (kind === 'cover_letter' && prompt.trim().length === 0)
              }
              onClick={() => void start()}
            >
              <Sparkles />
              {starting
                ? 'Starting workflows…'
                : `Process ${parsedUrls.length || ''} URL${parsedUrls.length === 1 ? '' : 's'}`}
            </Button>
          </CardContent>
        </Card>

        <section className="grid gap-3" aria-labelledby="workflow-runs-title">
          <div>
            <h2 id="workflow-runs-title" className="text-lg font-semibold">
              Session runs
            </h2>
            <p className="text-sm text-muted-foreground">
              Open a saved candidate when it reaches human review.
            </p>
          </div>
          {runsResult._tag === 'Failure' ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>
                The in-memory workflow runtime could not be created.
              </AlertDescription>
            </Alert>
          ) : runs.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No workflows have been started in this browser session.
              </CardContent>
            </Card>
          ) : (
            runs.map((run) => <PreparationRunCard key={run.runId} run={run} />)
          )}
        </section>
      </div>
    </main>
  )
}
