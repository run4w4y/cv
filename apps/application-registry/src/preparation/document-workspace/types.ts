import type * as React from 'react'

export type DocumentPath = ReadonlyArray<string | number>

export type DocumentWorkspaceMode = 'edit' | 'preview' | 'changes'

export type DocumentValidationIssue = {
  readonly message: string
  readonly path: DocumentPath
  readonly pointer?: string
}

export type DocumentChange = {
  readonly after: unknown
  readonly before: unknown
  readonly kind: 'added' | 'changed' | 'removed'
  readonly path: DocumentPath
}

export type DocumentMutationHandlers = {
  readonly onAdd?: (path: DocumentPath, value: unknown, index?: number) => void
  readonly onEdit: (path: DocumentPath, value: unknown) => void
  readonly onMove?: (
    path: DocumentPath,
    fromIndex: number,
    toIndex: number
  ) => void
  readonly onRemove?: (path: DocumentPath, index: number) => void
}

export type DocumentMutationFailure = {
  readonly cause: unknown
  readonly message: string
  readonly operation: 'add' | 'edit' | 'move' | 'remove'
  readonly path: DocumentPath
}

export type DocumentMutationStatusListener = (
  failure: DocumentMutationFailure | null
) => void

export type DocumentAssistantMessage = {
  readonly changeCount?: number
  readonly content: string
  readonly createdAt?: number
  readonly id: string
  readonly role: 'assistant' | 'user'
  readonly status?: 'applied' | 'failed' | 'invalid' | 'sending' | 'stale'
}

export type DocumentAssistant = {
  readonly available: boolean
  readonly composer: string
  readonly messages: ReadonlyArray<DocumentAssistantMessage>
  readonly onComposerChange: (value: string) => void
  readonly onSubmitComposer: () => Promise<void> | void
  readonly pending: boolean
  readonly placeholder?: string
  readonly unavailableReason?: string
}

export type DocumentWorkspaceAction = {
  readonly disabled?: boolean
  readonly kind: 'approve' | 'open' | 'publish' | 'save'
  readonly label: string
  readonly onAction: () => Promise<void> | void
  readonly pending?: boolean
}

export type DocumentWorkspaceProps = {
  readonly assistant: DocumentAssistant
  readonly canRedo: boolean
  readonly canUndo: boolean
  readonly changes: ReadonlyArray<DocumentChange>
  readonly children: React.ReactNode
  readonly dirty: boolean
  readonly disabled?: boolean
  readonly error?: string | null
  readonly mode: DocumentWorkspaceMode
  readonly onModeChange: (mode: DocumentWorkspaceMode) => void
  readonly onRedo: () => void
  readonly onUndo: () => void
  readonly postingHref?: string
  readonly preview: React.ReactNode
  readonly previewIsStale?: boolean
  readonly primaryAction: DocumentWorkspaceAction
  readonly title: string
  readonly validationIssues: ReadonlyArray<DocumentValidationIssue>
}
