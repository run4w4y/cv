import {
  Alert,
  AlertDescription,
  AlertTitle,
  Field,
  FieldLabel,
  Select,
} from '@cv/internal-ui'
import { CircleAlert } from 'lucide-react'

import { useChatGptModels } from '../hooks'

export const ModelSelector = ({
  authenticated,
  value,
  onChange,
}: {
  readonly authenticated: boolean
  readonly value: string | null
  readonly onChange: (modelId: string) => void
}) => {
  const models = useChatGptModels(authenticated)

  if (!authenticated) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect ChatGPT to discover the models available on your subscription.
      </p>
    )
  }
  if (models.status === 'loading') {
    return <p className="text-sm text-muted-foreground">Loading models…</p>
  }
  if (models.status === 'error') {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Could not load models</AlertTitle>
        <AlertDescription>{models.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Field>
      <FieldLabel>Generation model</FieldLabel>
      <Select
        ariaLabel="Generation model"
        value={value}
        options={models.value.map((model) => ({
          value: model.id,
          label: model.id,
        }))}
        onValueChange={(modelId) => {
          if (modelId !== null) onChange(modelId)
        }}
      />
    </Field>
  )
}
