import {
  cvAuthoringSourceForGeneration,
  validateCvProvenance,
} from '@cv/application-preparation-workflow'
import {
  type CoverLetterDocument,
  CoverLetterDocumentSchema,
} from '@cv/application-preparation-workflow/cover-letter'
import type {
  ContentRevisionResult,
  DocumentKind,
  PreparationArtifact,
  PreparationJob,
} from '@cv/application-preparation-workflow/domain'
import type { CvLink } from '@cv/application-registry-entity'
import {
  type CvDocumentV1,
  CvDocumentV1Schema,
  cvDocumentV1ContractId,
  cvDocumentV1Version,
} from '@cv/contracts/document'
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import { Cause, Effect, Exit, Schema } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { registryCvWebPreviewUrl } from '@/host/cv-web-preview'
import { asyncResultErrorMessage } from '@/lib/async-result'
import {
  appendPreparationRevisionAtom,
  contentHeadAtom,
  contentRevisionAtom,
  type PreparationContext,
  preparationContextAtom,
  type SavedContentRevision,
} from '@/preparation/data'
import {
  cvDocumentPolicy,
  DocumentAssistantProvider,
  type DocumentStudioAtoms,
  type DocumentStudioDocument,
  DocumentStudioProvider,
  type DocumentStudioState,
  documentAssistantContext,
  documentAssistantInstructions,
  useDocumentAssistant,
  useDocumentStudioAtoms,
} from '@/preparation/document-state'
import {
  CoverLetterDocumentEditor,
  CoverLetterDocumentPreview,
  CvDocumentEditor,
  CvWebPreview,
  type DocumentMutationFailure,
  type DocumentMutationHandlers,
  DocumentWorkspace,
  type DocumentWorkspaceAction,
  DocumentWorkspaceError,
  type DocumentWorkspaceMode,
  DocumentWorkspaceSkeleton,
  documentChangeSummary,
  documentMutationHandlers,
  documentValidationIssues,
} from '@/preparation/document-workspace'
import {
  CvPublicationWorkflowProvider,
  currentCvPageAtom,
  cvPublicationRunAtom,
  makeStartCvPublicationAtom,
} from '@/preparation/publication'
import {
  approveArtifactAtom,
  preparationJobAtom,
  selectPreparationArtifact,
} from '@/preparation/workflow/atoms'

type PersistedDocument = {
  readonly document: DocumentStudioDocument
  readonly result: ContentRevisionResult
}

export type ArtifactWorkspacePageProps = {
  readonly backTo: string
  readonly batchId: string
  readonly jobId: string
}

const startCvPublicationFamily = Atom.family((_identityKey: string) =>
  makeStartCvPublicationAtom()
)
const documentMutationFailureFamily = Atom.family((_key: string) =>
  Atom.make<DocumentMutationFailure | null>(null)
)

const contractFor = (kind: DocumentKind) =>
  kind === 'cv'
    ? {
        id: cvDocumentV1ContractId,
        version: String(cvDocumentV1Version),
      }
    : {
        id: 'cover-letter.v1',
        version: '1',
      }

const candidateDocument = (
  artifact: PreparationArtifact,
  kind: DocumentKind
): DocumentStudioDocument | null => {
  const generated = artifact.candidate?.candidate
  if (generated === undefined || generated === null) return null
  if (kind === 'cv') {
    return generated._tag === 'Cv' ? generated.document : null
  }
  return generated._tag === 'CoverLetter' ? generated.document : null
}

const persistedFromSavedRevision = (
  saved: SavedContentRevision,
  kind: DocumentKind
): PersistedDocument | null => {
  const expected =
    kind === 'cv'
      ? Schema.is(CvDocumentV1Schema)(saved.value)
      : Schema.is(CoverLetterDocumentSchema)(saved.value)
  if (!expected || saved.entry.kind !== kind) return null
  return {
    document: saved.value as DocumentStudioDocument,
    result: {
      entry: saved.entry,
      revision: saved.revision,
    },
  }
}

const actionFailureMessage = (
  result: AsyncResult.AsyncResult<unknown, unknown>,
  fallback: string
): string | null => asyncResultErrorMessage(result, fallback) ?? null

const actionPromise = async <A, E>(
  result: Promise<Exit.Exit<A, E>>
): Promise<A> => {
  const exit = await result
  if (Exit.isFailure(exit)) throw Cause.squash(exit.cause)
  return exit.value
}

const useDocumentMutations = (
  studio: DocumentStudioAtoms,
  revision: number
): {
  readonly error: string | null
  readonly handlers: DocumentMutationHandlers
  readonly clearError: () => void
} => {
  const failureAtom = documentMutationFailureFamily(
    `${studio.key}:revision:${revision}`
  )
  const failure = useAtomValue(failureAtom)
  const setFailure = useAtomSet(failureAtom)
  const edit = useAtomSet(studio.edit, { mode: 'promiseExit' })
  const insert = useAtomSet(studio.insert, { mode: 'promiseExit' })
  const move = useAtomSet(studio.move, { mode: 'promiseExit' })
  const remove = useAtomSet(studio.remove, { mode: 'promiseExit' })
  const removeAt = useAtomSet(studio.removeAt, { mode: 'promiseExit' })

  const clearError = () => setFailure(null)
  const handlers = documentMutationHandlers(
    {
      edit: (path, value) => actionPromise(edit({ path, value })),
      insert: (path, index, value) =>
        actionPromise(insert({ index, path, value })),
      move: (path, fromIndex, toIndex) =>
        actionPromise(move({ fromIndex, path, toIndex })),
      remove: (path) => actionPromise(remove(path)),
      removeAt: (path, index) => actionPromise(removeAt({ index, path })),
    },
    setFailure
  )

  return {
    clearError,
    error: failure?.message ?? null,
    handlers,
  }
}

const activePublicationTags = new Set([
  'Queued',
  'PublishingLink',
  'Cancelling',
])

type CvPublicationView = {
  readonly action: DocumentWorkspaceAction
  readonly currentRevisionId: string | null
  readonly error: string | null
  readonly previewLoading: boolean
  readonly previewUrl: string | null
}

const previewUrlFor = (link: CvLink): string => {
  const url = new URL(registryCvWebPreviewUrl(link))
  url.searchParams.set('revision', link.currentRevisionId)
  return url.toString()
}

const useCvPublication = ({
  applicationId,
  approvedRevision,
  entryId,
}: {
  readonly applicationId: string
  readonly approvedRevision: ContentRevisionResult | null
  readonly entryId: string
}): CvPublicationView => {
  const identity = { applicationId, entryId }
  const [startResult, startPublication] = useAtom(
    startCvPublicationFamily(`${applicationId}:${entryId}`),
    {
      mode: 'promiseExit',
    }
  )
  const pageResult = useAtomValue(currentCvPageAtom(identity))
  const runResult = useAtomValue(cvPublicationRunAtom(identity))
  const page = pageResult._tag === 'Success' ? pageResult.value : null
  const run = runResult._tag === 'Success' ? runResult.value : null
  const runLink = run?._tag === 'Published' ? run.result.link : null
  const currentLink =
    runLink !== null &&
    (page === null ||
      runLink.publicationVersion >= page.link.publicationVersion)
      ? runLink
      : page?.link
  const approvedRevisionId = approvedRevision?.revision.id ?? null
  const approvedEntry =
    approvedRevision !== null &&
    approvedRevision.entry.state === 'approved' &&
    approvedRevision.entry.approvedRevisionId === approvedRevisionId
      ? approvedRevision.entry
      : null
  const running =
    AsyncResult.isWaiting(startResult) ||
    (run !== null && activePublicationTags.has(run._tag))
  const revisionIsStaged =
    approvedRevisionId !== null &&
    currentLink?.currentRevisionId === approvedRevisionId
  const published = revisionIsStaged && currentLink?.enabled === true

  let previewUrl: string | null = null
  let previewError: string | null = null
  if (currentLink !== undefined) {
    try {
      previewUrl = previewUrlFor(currentLink)
    } catch (error) {
      previewError =
        error instanceof Error
          ? error.message
          : 'The saved CV preview URL is invalid.'
    }
  }

  const publish = async () => {
    if (
      running ||
      published ||
      approvedEntry === null ||
      page === null ||
      page.link.currentRevisionId !== approvedRevisionId
    ) {
      return
    }
    await startPublication({
      applicationId,
      entry: approvedEntry,
      expectedPublicationVersion: page.link.publicationVersion,
    })
  }

  const openPublished = () => {
    if (!published || currentLink === undefined) return
    globalThis.open(currentLink.publicUrl, '_blank', 'noopener,noreferrer')
  }

  const queryError = asyncResultErrorMessage(
    pageResult,
    'The saved CV preview could not be loaded.'
  )
  const startError = asyncResultErrorMessage(
    startResult,
    'The approved CV could not be published.'
  )
  const runError = run?._tag === 'Failed' ? run.error.message : null
  const bindingError =
    approvedRevision !== null &&
    pageResult._tag === 'Success' &&
    page !== null &&
    !revisionIsStaged
      ? 'Publication is not staged for the approved CV revision yet.'
      : null

  return {
    action: published
      ? {
          kind: 'open',
          label: 'Open published CV',
          onAction: openPublished,
        }
      : {
          disabled:
            running ||
            approvedEntry === null ||
            page === null ||
            !revisionIsStaged,
          kind: 'publish',
          label: running ? 'Publishing CV' : 'Publish CV',
          onAction: publish,
          pending: running,
        },
    currentRevisionId: currentLink?.currentRevisionId ?? null,
    error: previewError ?? startError ?? runError ?? queryError ?? bindingError,
    previewLoading: AsyncResult.isWaiting(pageResult),
    previewUrl,
  }
}

type EditableWorkspaceReadyProps = {
  readonly artifact: PreparationArtifact
  readonly context: PreparationContext
  readonly initial: PersistedDocument
  readonly job: PreparationJob
  readonly kind: DocumentKind
  readonly publication?: CvPublicationView
  readonly state: DocumentStudioState
  readonly studio: DocumentStudioAtoms
}

const EditableWorkspaceReady = ({
  artifact,
  context,
  initial,
  job,
  kind,
  publication,
  state,
  studio,
}: EditableWorkspaceReadyProps) => {
  const candidate = artifact.candidate
  if (candidate === null) {
    throw new Error('A resolved artifact workspace requires a candidate.')
  }

  const applicationId = candidate.application.id
  const assistant = useDocumentAssistant()
  const [mode, setMode] = useAtom(studio.mode)
  const mutations = useDocumentMutations(studio, state.revision)
  const [appendResult, appendRevision] = useAtom(
    appendPreparationRevisionAtom,
    { mode: 'promiseExit' }
  )
  const [submitResult, submit] = useAtom(studio.submit, {
    mode: 'promiseExit',
  })
  const [approvalResult, approveArtifact] = useAtom(approveArtifactAtom, {
    mode: 'promiseExit',
  })
  const [, undo] = useAtom(studio.undo, { mode: 'promiseExit' })
  const [, redo] = useAtom(studio.redo, { mode: 'promiseExit' })

  const persistedResult =
    AsyncResult.isSuccess(appendResult) &&
    appendResult.value.entry.id === initial.result.entry.id
      ? appendResult.value
      : artifact.status === 'approved'
        ? candidate.result
        : initial.result
  const validationIssues = [
    ...documentValidationIssues(state.validation.issues),
    ...state.policyIssues.map((issue) => ({
      message: issue.message,
      path: issue.path.map((segment) =>
        typeof segment === 'number' ? segment : String(segment)
      ),
    })),
  ]
  const savePending =
    AsyncResult.isWaiting(appendResult) || AsyncResult.isWaiting(submitResult)
  const approvalPending = AsyncResult.isWaiting(approvalResult)
  const readOnly = artifact.status !== 'awaiting_review'
  const cvPreviewReady =
    kind !== 'cv' ||
    publication?.currentRevisionId === persistedResult.revision.id
  const postingHref =
    context.jobSnapshot.finalUrl ?? context.jobSnapshot.requestedUrl ?? job.url

  const save = () => {
    mutations.clearError()
    const contract = contractFor(kind)
    void submit({
      persist: async (submitted) => {
        if (kind === 'cv') {
          await Effect.runPromise(
            validateCvProvenance(
              context.factsCatalogue,
              submitted as CvDocumentV1
            )
          )
        }
        const saved = await actionPromise(
          appendRevision({
            applicationId,
            contractId: contract.id,
            contractVersion: contract.version,
            entry: persistedResult.entry,
            factsReleaseId: persistedResult.revision.factsReleaseId,
            jobSnapshotId: persistedResult.revision.jobSnapshotId,
            operationId: `${job.jobId}:${kind}:human:${globalThis.crypto.randomUUID()}`,
            source: 'human',
            value: submitted,
          })
        )
        if (saved.entry.id !== persistedResult.entry.id) {
          throw new Error(
            'The saved revision was returned for a different document entry.'
          )
        }
        return submitted
      },
    })
  }

  const approve = () => {
    mutations.clearError()
    void approveArtifact({
      artifact: kind,
      jobId: job.jobId,
      revisionId: persistedResult.revision.id,
    })
  }

  let primaryAction: DocumentWorkspaceAction
  if (artifact.status === 'awaiting_review' && state.dirty) {
    primaryAction = {
      disabled: !state.valid || savePending || approvalPending,
      kind: 'save',
      label: 'Save draft',
      onAction: save,
      pending: savePending,
    }
  } else if (artifact.status === 'awaiting_review') {
    primaryAction = cvPreviewReady
      ? {
          disabled: !state.valid || approvalPending || savePending,
          kind: 'approve',
          label: 'Approve',
          onAction: approve,
          pending: approvalPending,
        }
      : {
          disabled: true,
          kind: 'save',
          label: 'Preparing preview',
          onAction: () => undefined,
          pending: true,
        }
  } else if (artifact.status === 'review_submitted') {
    primaryAction = {
      disabled: true,
      kind: 'approve',
      label: 'Approving',
      onAction: () => undefined,
      pending: true,
    }
  } else if (artifact.status === 'approved' && publication !== undefined) {
    primaryAction = publication.action
  } else {
    primaryAction = {
      disabled: true,
      kind: 'approve',
      label: artifact.status === 'approved' ? 'Approved' : 'Unavailable',
      onAction: () => undefined,
    }
  }

  const mutationError =
    mutations.error ??
    actionFailureMessage(
      submitResult,
      'The document revision could not be saved.'
    ) ??
    actionFailureMessage(
      appendResult,
      'The document revision could not be saved.'
    ) ??
    actionFailureMessage(
      approvalResult,
      'The document could not be approved.'
    ) ??
    artifact.error ??
    publication?.error ??
    null
  const preview =
    kind === 'cv' ? (
      <CvWebPreview
        loading={publication?.previewLoading}
        url={publication?.previewUrl ?? null}
      />
    ) : (
      <CoverLetterDocumentPreview
        document={state.previewDocument as CoverLetterDocument}
      />
    )

  return (
    <DocumentWorkspace
      assistant={assistant}
      canRedo={!readOnly && state.canRedo}
      canUndo={!readOnly && state.canUndo}
      changes={documentChangeSummary(state.original, state.document)}
      dirty={state.dirty}
      disabled={readOnly || savePending || approvalPending}
      error={mutationError}
      mode={mode as DocumentWorkspaceMode}
      onModeChange={setMode}
      onRedo={() => {
        mutations.clearError()
        void redo()
      }}
      onUndo={() => {
        mutations.clearError()
        void undo()
      }}
      postingHref={postingHref}
      preview={preview}
      previewIsStale={
        kind === 'cv'
          ? state.dirty ||
            publication?.currentRevisionId !== persistedResult.revision.id
          : state.previewIsStale
      }
      primaryAction={primaryAction}
      title={kind === 'cv' ? 'Tailored CV' : 'Cover letter'}
      validationIssues={validationIssues}
    >
      {kind === 'cv' ? (
        <CvDocumentEditor
          disabled={readOnly || savePending || approvalPending}
          document={state.document as CvDocumentV1}
          issues={validationIssues}
          mutations={mutations.handlers}
          reviewed={cvAuthoringSourceForGeneration(context.factsCatalogue)}
        />
      ) : (
        <CoverLetterDocumentEditor
          disabled={readOnly || savePending || approvalPending}
          document={state.document as CoverLetterDocument}
          issues={validationIssues}
          mutations={mutations.handlers}
        />
      )}
    </DocumentWorkspace>
  )
}

const CvEditableWorkspaceReady = (
  props: Omit<EditableWorkspaceReadyProps, 'publication'>
) => {
  const candidate = props.artifact.candidate
  if (candidate === null) {
    throw new Error('A resolved CV workspace requires a candidate.')
  }
  const publication = useCvPublication({
    applicationId: candidate.application.id,
    approvedRevision:
      props.artifact.status === 'approved' ? candidate.result : null,
    entryId: candidate.result.entry.id,
  })
  return <EditableWorkspaceReady {...props} publication={publication} />
}

const DocumentStudioWorkspace = ({
  artifact,
  backTo,
  context,
  initial,
  job,
  kind,
}: Omit<EditableWorkspaceReadyProps, 'publication' | 'state' | 'studio'> & {
  readonly backTo: string
}) => {
  const studio = useDocumentStudioAtoms()
  const stateResult = useAtomValue(studio)
  const stateError = asyncResultErrorMessage(
    stateResult,
    'The document editing session could not be prepared.'
  )

  if (stateResult._tag !== 'Success') {
    return stateError === null ? (
      <DocumentWorkspaceSkeleton />
    ) : (
      <DocumentWorkspaceError
        backTo={backTo}
        description={
          stateError ?? 'The document editing session could not be prepared.'
        }
        title="Document unavailable"
      />
    )
  }

  const props = {
    artifact,
    context,
    initial,
    job,
    kind,
    state: stateResult.value,
    studio,
  }
  return kind === 'cv' ? (
    <CvEditableWorkspaceReady {...props} kind="cv" />
  ) : (
    <EditableWorkspaceReady {...props} kind="cover_letter" />
  )
}

const ScopedArtifactWorkspace = ({
  artifact,
  backTo,
  context,
  initial,
  job,
  kind,
}: Omit<EditableWorkspaceReadyProps, 'publication' | 'state' | 'studio'> & {
  readonly backTo: string
}) => {
  const candidate = artifact.candidate
  if (candidate === null) {
    throw new Error('A resolved artifact workspace requires a candidate.')
  }
  const identity =
    kind === 'cv'
      ? ({
          applicationId: candidate.application.id,
          kind,
          locale: job.locale,
        } as const)
      : ({
          applicationId: candidate.application.id,
          kind,
          locale: job.locale,
          referenceCvRevisionId: (initial.document as CoverLetterDocument)
            .referenceCvRevisionId,
        } as const)
  const policy =
    kind === 'cv'
      ? cvDocumentPolicy(
          context.factsCatalogue,
          context.cvGenerationGuidance,
          job.company ?? candidate.application.company
        )
      : undefined
  const assistantContext = documentAssistantContext({
    company: job.company ?? candidate.application.company,
    factsCatalogue: context.factsCatalogue,
    jobContext: context.jobContext,
    postingUrl:
      context.jobSnapshot.finalUrl ?? context.jobSnapshot.requestedUrl,
    role: job.role ?? candidate.application.role,
  })
  const assistantInstructions = documentAssistantInstructions(
    kind,
    context.cvGenerationGuidance
  )

  return (
    <DocumentStudioProvider
      value={{
        authoritativeKey: `${job.jobId}:${kind}:${initial.result.entry.id}`,
        document: initial.document,
        identity,
        policy,
        policyKey: context.factsReleaseId,
      }}
    >
      <DocumentAssistantProvider
        assistantKey={`${job.jobId}:${kind}:${initial.result.entry.id}`}
        context={assistantContext}
        instructions={assistantInstructions}
      >
        <DocumentStudioWorkspace
          artifact={artifact}
          backTo={backTo}
          context={context}
          initial={initial}
          job={job}
          kind={kind}
        />
      </DocumentAssistantProvider>
    </DocumentStudioProvider>
  )
}

const SourceBoundArtifactWorkspace = ({
  artifact,
  backTo,
  initial,
  job,
  kind,
}: Omit<
  EditableWorkspaceReadyProps,
  'context' | 'publication' | 'state' | 'studio'
> & {
  readonly backTo: string
}) => {
  const candidate = artifact.candidate
  if (candidate === null) {
    throw new Error('A resolved artifact workspace requires a candidate.')
  }
  const contextResult = useAtomValue(
    preparationContextAtom({
      applicationId: candidate.application.id,
      locale: job.locale,
    })
  )
  const contextError = asyncResultErrorMessage(
    contextResult,
    'The reviewed facts and job posting could not be loaded.'
  )
  if (contextResult._tag !== 'Success') {
    return contextError === null ? (
      <DocumentWorkspaceSkeleton label="Loading reviewed document sources" />
    ) : (
      <DocumentWorkspaceError
        backTo={backTo}
        description={
          contextError ?? 'The reviewed document sources could not be loaded.'
        }
        title="Document sources unavailable"
      />
    )
  }
  if (
    initial.result.revision.factsReleaseId !==
      contextResult.value.factsReleaseId ||
    initial.result.revision.jobSnapshotId !== contextResult.value.jobSnapshot.id
  ) {
    return (
      <DocumentWorkspaceError
        backTo={backTo}
        description="The reviewed facts or job posting no longer matches the sources pinned to this document. Start a new AI workflow to create a clean draft."
        title="Document sources changed"
      />
    )
  }

  return (
    <ScopedArtifactWorkspace
      artifact={artifact}
      backTo={backTo}
      context={contextResult.value}
      initial={initial}
      job={job}
      kind={kind}
    />
  )
}

const ResolvedArtifactWorkspace = ({
  artifact,
  backTo,
  document,
  job,
  kind,
}: {
  readonly artifact: PreparationArtifact
  readonly backTo: string
  readonly document: DocumentStudioDocument
  readonly job: PreparationJob
  readonly kind: DocumentKind
}) => {
  const candidate = artifact.candidate
  if (candidate === null) {
    throw new Error('A resolved artifact workspace requires a candidate.')
  }
  const applicationId = candidate.application.id
  const headResult = useAtomValue(
    contentHeadAtom({ applicationId, kind, locale: job.locale })
  )
  const exactResult = useAtomValue(
    contentRevisionAtom({
      applicationId,
      entryId: candidate.result.entry.id,
      revisionId: candidate.result.revision.id,
    })
  )
  const selectedResult =
    artifact.status === 'approved' ? exactResult : headResult
  const loadError = asyncResultErrorMessage(
    selectedResult,
    'The saved document revision could not be loaded.'
  )
  if (selectedResult._tag !== 'Success') {
    return loadError === null ? (
      <DocumentWorkspaceSkeleton />
    ) : (
      <DocumentWorkspaceError
        backTo={backTo}
        description={loadError ?? 'The saved document could not be loaded.'}
        title="Document unavailable"
      />
    )
  }

  const saved = selectedResult.value
  const stored = saved === null ? null : persistedFromSavedRevision(saved, kind)
  if (
    (saved !== null && saved.entry.id !== candidate.result.entry.id) ||
    (saved !== null && stored === null)
  ) {
    return (
      <DocumentWorkspaceError
        backTo={backTo}
        description="The stored revision does not match this workflow artifact or document contract."
        title="Document revision mismatch"
      />
    )
  }
  const initial: PersistedDocument = stored ?? {
    document,
    result: candidate.result,
  }
  if (
    artifact.status === 'approved' &&
    initial.result.revision.id !== candidate.result.revision.id
  ) {
    return (
      <DocumentWorkspaceError
        backTo={backTo}
        description="The approved workflow revision could not be matched to its saved document."
        title="Approved revision unavailable"
      />
    )
  }

  return (
    <SourceBoundArtifactWorkspace
      artifact={artifact}
      backTo={backTo}
      initial={initial}
      job={job}
      kind={kind}
    />
  )
}

export const ArtifactWorkspacePage = ({
  backTo,
  batchId,
  jobId,
  kind,
}: ArtifactWorkspacePageProps & {
  readonly kind: DocumentKind
}) => {
  const jobResult = useAtomValue(preparationJobAtom(jobId))
  const loadError = asyncResultErrorMessage(
    jobResult,
    'The AI workflow could not be loaded.'
  )
  if (jobResult._tag !== 'Success') {
    return loadError === null ? (
      <DocumentWorkspaceSkeleton />
    ) : (
      <DocumentWorkspaceError
        backTo={backTo}
        description={loadError ?? 'The AI workflow could not be loaded.'}
        title="Workflow unavailable"
      />
    )
  }

  const job = jobResult.value
  if (job === null || job.batchId !== batchId) {
    return (
      <DocumentWorkspaceError
        backTo={backTo}
        description="This document does not belong to the requested AI workflow."
        title="Document not found"
      />
    )
  }
  const artifact = selectPreparationArtifact(job, kind)
  if (artifact === null) {
    return (
      <DocumentWorkspaceError
        backTo={backTo}
        description={`This workflow does not include a ${
          kind === 'cv' ? 'CV' : 'cover letter'
        } artifact.`}
        title="Document not requested"
      />
    )
  }

  const document = candidateDocument(artifact, kind)
  if (artifact.candidate === null || document === null) {
    if (
      artifact.status === 'failed' ||
      artifact.status === 'blocked' ||
      artifact.status === 'cancelled'
    ) {
      return (
        <DocumentWorkspaceError
          backTo={backTo}
          description={
            artifact.error ??
            artifact.message ??
            'The document could not be generated.'
          }
          title="Document generation failed"
        />
      )
    }
    return <DocumentWorkspaceSkeleton label="Generating document workspace" />
  }

  return (
    <ResolvedArtifactWorkspace
      artifact={artifact}
      backTo={backTo}
      document={document}
      job={job}
      key={`${job.jobId}:${kind}`}
      kind={kind}
    />
  )
}

export const CvPreparationWorkspacePage = (
  props: ArtifactWorkspacePageProps
) => (
  <CvPublicationWorkflowProvider>
    <ArtifactWorkspacePage {...props} kind="cv" />
  </CvPublicationWorkflowProvider>
)

export const CoverLetterWorkspacePage = (props: ArtifactWorkspacePageProps) => (
  <ArtifactWorkspacePage {...props} kind="cover_letter" />
)
