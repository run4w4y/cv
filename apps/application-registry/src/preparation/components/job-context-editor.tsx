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
  Textarea,
} from '@cv/internal-ui'
import { CircleAlert, Save } from 'lucide-react'
import * as React from 'react'

import { manualJobContextMaxBytes, persistManualJobContext } from '../api'
import { messageFromCause } from '../hooks'

export const editableJobContext = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  return JSON.stringify(value, null, 2) ?? String(value)
}

export const JobContextEditor = ({
  applicationId,
  initialContext,
  onSaved,
}: {
  readonly applicationId: string
  readonly initialContext?: unknown
  readonly onSaved: () => void
}) => {
  const initialText = React.useMemo(
    () => editableJobContext(initialContext),
    [initialContext]
  )
  const [value, setValue] = React.useState(initialText)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const byteLength = React.useMemo(
    () => new TextEncoder().encode(value.trim()).byteLength,
    [value]
  )
  const tooLarge = byteLength > manualJobContextMaxBytes

  React.useEffect(() => setValue(initialText), [initialText])

  const save = async () => {
    setPending(true)
    setError(null)
    try {
      await persistManualJobContext(applicationId, value)
      onSaved()
    } catch (cause) {
      setError(
        messageFromCause(cause, 'The corrected job context could not be saved.')
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Job role and requirements</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Review the normalized posting text before generation. If capture
              failed or missed client-rendered content, paste or correct the
              role and requirements here. Saving creates a new normalized
              snapshot; every original raw capture remains immutable.
            </CardDescription>
          </div>
          <Badge variant={tooLarge ? 'danger' : 'outline'}>
            {byteLength.toLocaleString('en-US')} /{' '}
            {manualJobContextMaxBytes.toLocaleString('en-US')} bytes
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field>
          <FieldLabel htmlFor={`job-context-${applicationId}`}>
            Normalized job context
          </FieldLabel>
          <FieldDescription>
            Plain text is passed to the model as job context and is not
            interpreted as CV or facts data by the backend.
          </FieldDescription>
          <Textarea
            id={`job-context-${applicationId}`}
            className="min-h-64 font-mono text-xs"
            value={value}
            placeholder={`Role: …\n\nResponsibilities:\n- …\n\nRequirements:\n- …`}
            disabled={pending}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        </Field>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Job context was not saved</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          className="w-fit"
          disabled={
            pending ||
            value.trim().length === 0 ||
            tooLarge ||
            value === initialText
          }
          onClick={() => void save()}
        >
          <Save />
          {pending ? 'Saving context…' : 'Save corrected context'}
        </Button>
      </CardContent>
    </Card>
  )
}
