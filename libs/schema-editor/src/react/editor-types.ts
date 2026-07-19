import type { EditorDescriptor, ValidationIssue } from '../core'

export type NodeEditorProps = {
  readonly descriptor: EditorDescriptor
  readonly value: unknown
  readonly onChange: (value: unknown) => void
  readonly pointer: string
  readonly issues: ReadonlyMap<string, ReadonlyArray<ValidationIssue>>
  readonly label?: string
  readonly disabled?: boolean
  readonly className?: string
}
