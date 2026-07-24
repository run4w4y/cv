import {
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Spinner,
  Textarea,
} from '@cv/internal-ui'
import { Sparkles } from 'lucide-react'
import * as React from 'react'

export const CodexRefinement = ({
  canRefine,
  codexAvailable,
  disabled,
  documentLabel,
  onRefine,
  refining,
}: {
  readonly canRefine: boolean
  readonly codexAvailable: boolean
  readonly disabled: boolean
  readonly documentLabel: string
  readonly onRefine: (instruction: string) => Promise<void>
  readonly refining: boolean
}) => {
  const [instruction, setInstruction] = React.useState('')
  const fieldId = `codex-refinement-${documentLabel.replaceAll(' ', '-')}`
  const unavailableReason = !codexAvailable
    ? 'Local Codex is unavailable.'
    : !canRefine
      ? 'Save the current document as a valid revision before refining it.'
      : null
  const blocked =
    disabled ||
    refining ||
    unavailableReason !== null ||
    instruction.trim().length === 0

  return (
    <div className="mt-5 rounded-lg border border-border bg-muted/20 p-4">
      <Field>
        <FieldLabel htmlFor={fieldId}>
          Ask Codex to refine this {documentLabel}
        </FieldLabel>
        <FieldDescription>
          Each request uses the latest saved revision, captured posting, and
          reviewed facts. It creates a schema-validated revision that remains
          subject to your approval.
        </FieldDescription>
        <Textarea
          id={fieldId}
          className="min-h-24 bg-background"
          disabled={disabled || refining}
          placeholder="For example: make the opening more direct and emphasize platform leadership."
          value={instruction}
          onChange={(event) => setInstruction(event.currentTarget.value)}
        />
        {unavailableReason === null ? null : (
          <p className="text-xs text-muted-foreground">{unavailableReason}</p>
        )}
        <Button
          className="w-fit"
          disabled={blocked}
          onClick={() => void onRefine(instruction)}
        >
          {refining ? <Spinner aria-hidden /> : <Sparkles />}
          {refining ? 'Refining…' : 'Create refined revision'}
        </Button>
      </Field>
    </div>
  )
}
