import type {
  DesktopBridgeError,
  DesktopBridgeResult,
  DesktopCodexStatus,
  DesktopDocumentAssistantResult,
} from '@cv/application-registry-desktop-contract'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import * as ScopedAtom from '@effect/atom-react/ScopedAtom'
import type { TreeInvariantError, TreePatch } from '@effect-state-tree/core'
import { Cause, Effect, Exit, Option, Schema } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import type * as AtomRegistry from 'effect/unstable/reactivity/AtomRegistry'
import * as React from 'react'

import { desktopBridge } from '@/host/desktop'
import type {
  DocumentAssistant,
  DocumentAssistantMessage,
} from '@/preparation/document-workspace/types'
import {
  type DocumentStudioActionError,
  type DocumentStudioAtoms,
  useDocumentStudioAtoms,
} from './react'
import {
  ProtectedDocumentPathError,
  StaleDocumentOperationError,
} from './session'

const messageId = (): string => globalThis.crypto.randomUUID()

const assistantFailureMessage = (error: DesktopBridgeError): string =>
  error.details === undefined ||
  error.details === null ||
  error.details.trim().length === 0
    ? error.message
    : `${error.message} ${error.details}`

const instructionsFor = (studio: DocumentStudioAtoms): string => {
  return [
    `You are collaborating with the user on their ${
      studio.kind === 'cv' ? 'CV' : 'cover letter'
    }.`,
    'Use reply for direct conversation and patches only for requested document edits.',
    'Keep edits focused. Do not invent personal facts, employers, dates, skills, metrics, or qualifications.',
    'Never change contract metadata, locale, identity fields, contact details, or provenance IDs.',
    'Tuple patch paths must target the supplied document exactly.',
  ].join(' ')
}

const assessmentInstructions = [
  'This is a read-only assessment turn.',
  'Return an empty patches array. Do not propose or perform document edits in this turn.',
  'Speak directly to the user in the reply.',
  'Compare the current document with the supplied job-posting context.',
  'Briefly identify: strongest alignment, noticeable gaps, uncovered requirements, questionable emphasis, and the single best next edit.',
  'Distinguish facts that are absent from the document from facts that are genuinely unsupported by the supplied evidence.',
].join(' ')

const assessmentPrompt = [
  'Assess this draft against the job posting before the user begins editing.',
  'Give a concise, candid gap analysis and a recommended next move.',
  'This is commentary only: return no patches.',
].join(' ')

export class DocumentAssistantError extends Schema.TaggedErrorClass<DocumentAssistantError>()(
  'DocumentAssistantError',
  {
    message: Schema.String,
    operation: Schema.Literals([
      'assessment',
      'assist',
      'busy',
      'cancel',
      'status',
    ]),
  }
) {}

type AssistantTurnMode = 'assessment' | 'conversation'

interface AssistantConversationState {
  readonly active:
    | {
        readonly mode: AssistantTurnMode
        readonly operationId: string
      }
    | undefined
  readonly messages: ReadonlyArray<DocumentAssistantMessage>
  readonly conversationThreadId: string | undefined
}

interface AssistantAtomContext {
  <A>(atom: Atom.Atom<A>): A
  readonly result: <A, E>(
    atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
    options?: { readonly suspendOnWaiting?: boolean }
  ) => Effect.Effect<A, E>
  readonly set: <R, W>(atom: Atom.Writable<R, W>, value: W) => void
  readonly setResult: <A, E, W>(
    atom: Atom.Writable<AsyncResult.AsyncResult<A, E>, W>,
    value: W
  ) => Effect.Effect<A, E>
  readonly registry: AtomRegistry.AtomRegistry
}

export interface DocumentAssistantScopeInput {
  readonly assistantKey: string
  readonly context?: Schema.Json
  readonly instructions?: string
  readonly studio: DocumentStudioAtoms
}

export type DocumentAssistantActionError =
  | DocumentAssistantError
  | DocumentStudioActionError
  | TreeInvariantError

export interface DocumentAssistantView {
  readonly assessment: AsyncResult.AsyncResult<
    void,
    DocumentAssistantActionError
  >
  readonly available: boolean
  readonly composer: string
  readonly messages: ReadonlyArray<DocumentAssistantMessage>
  readonly pending: boolean
  readonly placeholder?: string
  readonly sendResult: AsyncResult.AsyncResult<
    void,
    DocumentAssistantActionError
  >
  readonly status: AsyncResult.AsyncResult<
    DesktopCodexStatus,
    DocumentAssistantError
  >
  readonly unavailableReason?: string
}

export interface DocumentAssistantAtoms
  extends Atom.Atom<DocumentAssistantView> {
  readonly composer: Atom.Writable<string>
  readonly messages: Atom.Atom<ReadonlyArray<DocumentAssistantMessage>>
  readonly status: Atom.Atom<
    AsyncResult.AsyncResult<DesktopCodexStatus, DocumentAssistantError>
  >
  readonly assessment: Atom.Atom<
    AsyncResult.AsyncResult<void, DocumentAssistantActionError>
  >
  readonly send: Atom.AtomResultFn<string, void, DocumentAssistantActionError>
  readonly submitComposer: Atom.AtomResultFn<
    void,
    void,
    DocumentAssistantActionError
  >
  readonly cancel: Atom.AtomResultFn<void, void, DocumentAssistantError>
  readonly retryAssessment: Atom.Writable<Option.Option<void>, void>
  readonly retryStatus: Atom.Writable<Option.Option<void>, void>
}

const bridgeResult = <A>(
  operation: DocumentAssistantError['operation'],
  request: () => Promise<DesktopBridgeResult<A>>
): Effect.Effect<A, DocumentAssistantError> =>
  Effect.tryPromise({
    try: request,
    catch: (cause) =>
      new DocumentAssistantError({
        message:
          cause instanceof Error
            ? cause.message
            : 'The desktop Codex bridge did not respond.',
        operation,
      }),
  }).pipe(
    Effect.flatMap((result) =>
      result.ok
        ? Effect.succeed(result.value)
        : Effect.fail(
            new DocumentAssistantError({
              message: assistantFailureMessage(result.error),
              operation,
            })
          )
    )
  )

const resultFailureMessage = <E>(
  result: AsyncResult.AsyncResult<unknown, E>,
  fallback: string
): string => {
  if (!AsyncResult.isFailure(result)) return fallback
  const error = Cause.findErrorOption(result.cause)
  if (Option.isSome(error) && error.value instanceof Error) {
    return error.value.message
  }
  return fallback
}

const markMessage = (
  messages: ReadonlyArray<DocumentAssistantMessage>,
  id: string,
  status: NonNullable<DocumentAssistantMessage['status']>
): ReadonlyArray<DocumentAssistantMessage> =>
  messages.map((message) =>
    message.id === id ? { ...message, status } : message
  )

const patchFailureCopy = (
  reply: string,
  error: unknown
): {
  readonly content: string
  readonly status: 'invalid' | 'stale'
} => {
  if (error instanceof StaleDocumentOperationError) {
    return {
      content: `${reply}\n\nThe document changed while I was working, so I did not apply these edits. Please send the request again against the current draft.`,
      status: 'stale',
    }
  }
  if (error instanceof ProtectedDocumentPathError) {
    return {
      content: `${reply}\n\nI did not apply the edits because they touched protected document fields.`,
      status: 'invalid',
    }
  }
  return {
    content: `${reply}\n\nThe proposed edits did not pass document validation and were not applied.`,
    status: 'invalid',
  }
}

const makeDocumentAssistantAtoms = (
  input: DocumentAssistantScopeInput
): DocumentAssistantAtoms => {
  const bridge = desktopBridge()
  const composer = Atom.make('')
  const conversation = Atom.make<AssistantConversationState>({
    active: undefined,
    conversationThreadId: undefined,
    messages: [],
  })
  const sendGate = Atom.make(false)
  let activeOperationId: string | undefined
  const cancelActiveOperation = (): Effect.Effect<void> => {
    const operationId = activeOperationId
    return bridge === null || operationId === undefined
      ? Effect.void
      : bridgeResult('cancel', () => bridge.codex.cancel(operationId)).pipe(
          Effect.ignore
        )
  }

  const status = Atom.make(
    Effect.gen(function* () {
      yield* Effect.addFinalizer(cancelActiveOperation)
      return yield* bridge === null
        ? Effect.fail(
            new DocumentAssistantError({
              message: 'Codex is available in the desktop app.',
              operation: 'status',
            })
          )
        : bridgeResult('status', () => bridge.codex.status())
    })
  )

  const runTurn = (
    mode: AssistantTurnMode,
    rawPrompt: string,
    get: AssistantAtomContext
  ): Effect.Effect<void, DocumentAssistantActionError> => {
    const prompt = rawPrompt.trim()
    const operationId = messageId()
    const userMessageId = messageId()
    let bridgeRequestStarted = false

    const updateConversation = (
      update: (
        current: AssistantConversationState
      ) => AssistantConversationState
    ): void => {
      const next = update(get.registry.get(conversation))
      activeOperationId = next.active?.operationId
      get.registry.set(conversation, next)
    }

    const appendAssistantMessage = (
      content: string,
      messageStatus: NonNullable<DocumentAssistantMessage['status']>,
      changeCount?: number
    ): void => {
      updateConversation((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            ...(changeCount === undefined ? {} : { changeCount }),
            content,
            createdAt: Date.now(),
            id: messageId(),
            role: 'assistant',
            status: messageStatus,
          },
        ],
      }))
    }

    const failVisibleConversation = (
      error: DocumentAssistantActionError
    ): Effect.Effect<void> =>
      Effect.sync(() => {
        if (mode === 'assessment') return
        updateConversation((current) => ({
          ...current,
          messages: [
            ...markMessage(current.messages, userMessageId, 'failed'),
            {
              content:
                error instanceof Error
                  ? error.message
                  : 'Codex could not complete this request.',
              createdAt: Date.now(),
              id: messageId(),
              role: 'assistant',
              status: 'failed',
            },
          ],
        }))
      })

    const clearActive = Effect.sync(() => {
      updateConversation((current) =>
        current.active?.operationId === operationId
          ? { ...current, active: undefined }
          : current
      )
      if (mode === 'conversation') {
        get.registry.set(sendGate, false)
      }
    })

    const cancelOnInterrupt = Effect.suspend(() => {
      if (bridge === null || !bridgeRequestStarted) {
        return Effect.void
      }
      return bridgeResult('cancel', () =>
        bridge.codex.cancel(operationId)
      ).pipe(Effect.ignore)
    })

    return Effect.gen(function* () {
      if (prompt.length === 0) return
      const bridgeStatus = yield* get.result(status)
      if (!bridgeStatus.available) {
        return yield* Effect.fail(
          new DocumentAssistantError({
            message: bridgeStatus.message,
            operation: mode === 'assessment' ? 'assessment' : 'assist',
          })
        )
      }
      if (bridge === null) {
        return yield* Effect.fail(
          new DocumentAssistantError({
            message: 'Codex is available in the desktop app.',
            operation: mode === 'assessment' ? 'assessment' : 'assist',
          })
        )
      }
      const currentConversation = get.registry.get(conversation)
      if (currentConversation.active !== undefined) {
        return yield* Effect.fail(
          new DocumentAssistantError({
            message: 'Codex is already working on this document.',
            operation: 'busy',
          })
        )
      }
      const activeSession = yield* get.result(input.studio.session)
      const checkpoint = activeSession.snapshot()
      const checkpointId = `document:${checkpoint.revision}:${messageId()}`

      updateConversation((current) => ({
        ...current,
        active: { mode, operationId },
        messages:
          mode === 'assessment'
            ? current.messages
            : [
                ...current.messages,
                {
                  content: prompt,
                  createdAt: Date.now(),
                  id: userMessageId,
                  role: 'user',
                  status: 'sending',
                },
              ],
      }))

      bridgeRequestStarted = true
      const result: DesktopDocumentAssistantResult = yield* bridgeResult(
        mode === 'assessment' ? 'assessment' : 'assist',
        () =>
          bridge.codex.assist({
            checkpointId,
            ...(input.context === undefined ? {} : { context: input.context }),
            document: checkpoint.document as Schema.Json,
            instructions: [
              instructionsFor(input.studio),
              input.instructions,
              mode === 'assessment' ? assessmentInstructions : undefined,
            ]
              .filter(
                (value): value is string =>
                  value !== undefined && value.trim().length > 0
              )
              .join('\n\n'),
            operationId,
            prompt,
            ...(mode !== 'conversation' ||
            currentConversation.conversationThreadId === undefined
              ? {}
              : {
                  threadId: currentConversation.conversationThreadId,
                }),
          })
      )

      if (
        result.operationId !== operationId ||
        result.checkpointId !== checkpointId
      ) {
        return yield* Effect.fail(
          new DocumentAssistantError({
            message:
              'Codex returned a response for a different document checkpoint.',
            operation: mode === 'assessment' ? 'assessment' : 'assist',
          })
        )
      }

      if (mode === 'assessment') {
        appendAssistantMessage(result.response.reply, 'applied')
        return
      }

      updateConversation((current) => ({
        ...current,
        conversationThreadId: result.threadId,
      }))

      const patches = result.response.patches as ReadonlyArray<TreePatch>
      const patchExit =
        patches.length === 0
          ? Exit.succeed(undefined)
          : yield* Effect.exit(
              get.setResult(input.studio.applyAssistantPatches, {
                expectedRevision: checkpoint.revision,
                patches,
              })
            )

      if (Exit.isFailure(patchExit)) {
        const typedError = Cause.findErrorOption(patchExit.cause)
        if (Option.isNone(typedError)) {
          return yield* Effect.failCause(patchExit.cause)
        }
        const copy = patchFailureCopy(result.response.reply, typedError.value)
        updateConversation((current) => ({
          ...current,
          messages: markMessage(current.messages, userMessageId, copy.status),
        }))
        appendAssistantMessage(copy.content, copy.status, patches.length)
        return
      }

      updateConversation((current) => ({
        ...current,
        messages: markMessage(current.messages, userMessageId, 'applied'),
      }))
      appendAssistantMessage(result.response.reply, 'applied', patches.length)
    }).pipe(
      Effect.tapError(failVisibleConversation),
      Effect.onInterrupt(() => cancelOnInterrupt),
      Effect.ensuring(clearActive),
      Effect.asVoid
    )
  }

  const sendExecution = Atom.fn<string>()((prompt, get) =>
    runTurn('conversation', prompt, get)
  )
  const send: Atom.AtomResultFn<string, void, DocumentAssistantActionError> =
    Atom.writable(
      (get) => get(sendExecution),
      (context, command) => {
        if (command === Atom.Reset || command === Atom.Interrupt) {
          context.set(sendExecution, command)
          if (command === Atom.Interrupt) context.set(sendGate, false)
          return
        }
        if (
          context.get(sendGate) ||
          context.get(conversation).active !== undefined
        ) {
          return
        }
        context.set(sendGate, true)
        context.set(sendExecution, command)
      }
    )
  const assessment = Atom.make((get) =>
    runTurn('assessment', assessmentPrompt, get)
  )
  const submitComposer = Atom.fn<void>()((_input, get) =>
    Effect.gen(function* () {
      const prompt = get.registry.get(composer).trim()
      if (prompt.length === 0) return
      yield* get.setResult(send, prompt)
      get.registry.set(composer, '')
    }).pipe(Effect.asVoid)
  )
  const cancel = Atom.fn<void>()((_input, get) => {
    const active = get.registry.get(conversation).active
    if (active === undefined || bridge === null) return Effect.void
    if (active.mode === 'conversation') {
      get.set(send, Atom.Interrupt)
      return Effect.void
    }
    return bridgeResult('cancel', () =>
      bridge.codex.cancel(active.operationId)
    ).pipe(Effect.asVoid)
  })
  const retryAssessment = Atom.fnSync<void>()((_input, get) => {
    get.refresh(assessment)
  })
  const retryStatus = Atom.fnSync<void>()((_input, get) => {
    get.refresh(status)
  })
  const messages = Atom.make((get) => get(conversation).messages)

  const view = Atom.make((get): DocumentAssistantView => {
    const statusResult = get(status)
    const assessmentResult = get(assessment)
    const sendResult = get(send)
    const currentConversation = get(conversation)
    const available =
      AsyncResult.isSuccess(statusResult) && statusResult.value.available
    const unavailableReason = AsyncResult.isSuccess(statusResult)
      ? statusResult.value.available
        ? undefined
        : statusResult.value.message
      : resultFailureMessage(statusResult, 'Codex is unavailable right now.')

    return {
      assessment: assessmentResult,
      available,
      composer: get(composer),
      messages: currentConversation.messages,
      pending:
        currentConversation.active !== undefined || assessmentResult.waiting,
      placeholder:
        input.studio.kind === 'cv'
          ? 'Ask Codex to tighten a section, emphasize relevant evidence, or explain a choice…'
          : 'Ask Codex to revise the tone, opening, emphasis, or structure…',
      sendResult,
      status: statusResult,
      ...(unavailableReason === undefined ? {} : { unavailableReason }),
    }
  })

  return Object.assign(view, {
    assessment,
    cancel,
    composer,
    messages,
    retryAssessment,
    retryStatus,
    send,
    status,
    submitComposer,
  })
}

const ScopedDocumentAssistant = ScopedAtom.make(makeDocumentAssistantAtoms)

export interface DocumentAssistantProviderProps {
  readonly assistantKey: string
  readonly children?: React.ReactNode
  readonly context?: Schema.Json
  readonly instructions?: string
}

export const DocumentAssistantProvider = ({
  assistantKey,
  children,
  context,
  instructions,
}: DocumentAssistantProviderProps): React.ReactElement => {
  const studio = useDocumentStudioAtoms()
  return React.createElement(
    ScopedDocumentAssistant.Provider,
    {
      key: JSON.stringify([studio.key, assistantKey] as const),
      value: {
        assistantKey,
        ...(context === undefined ? {} : { context }),
        ...(instructions === undefined ? {} : { instructions }),
        studio,
      },
    },
    children
  )
}

export const useDocumentAssistantAtoms = (): DocumentAssistantAtoms =>
  ScopedDocumentAssistant.use()

export interface DocumentAssistantController
  extends DocumentAssistant,
    Pick<
      DocumentAssistantView,
      'assessment' | 'composer' | 'sendResult' | 'status'
    > {
  readonly onSend: (prompt: string) => Promise<void>
  readonly onComposerChange: (value: string) => void
  readonly onSubmitComposer: () => Promise<void>
}

export const useDocumentAssistant = (): DocumentAssistantController => {
  const atoms = useDocumentAssistantAtoms()
  const assistant = useAtomValue(atoms)
  const setComposer = useAtomSet(atoms.composer)
  const send = useAtomSet(atoms.send, { mode: 'promise' })
  const submitComposer = useAtomSet(atoms.submitComposer, {
    mode: 'promise',
  })
  return {
    ...assistant,
    onComposerChange: setComposer,
    onSend: async (prompt) => {
      await send(prompt)
    },
    onSubmitComposer: async () => {
      await submitComposer()
    },
  }
}
