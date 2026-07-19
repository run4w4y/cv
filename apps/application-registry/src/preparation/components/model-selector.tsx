import {
  Alert,
  AlertDescription,
  AlertTitle,
  Field,
  FieldLabel,
  Select,
} from '@cv/internal-ui'
import { useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { CircleAlert } from 'lucide-react'

import { preparationModelsAtom } from '../data'

export const ModelSelector = ({
  authenticated,
  value,
  onChange,
}: {
  readonly authenticated: boolean
  readonly value: string | null
  readonly onChange: (modelId: string) => void
}) => {
  const models = useAtomValue(preparationModelsAtom(authenticated))

  if (!authenticated) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect ChatGPT to discover the models available on your subscription.
      </p>
    )
  }
  if (models._tag === 'Initial' || AsyncResult.isWaiting(models)) {
    return <p className="text-sm text-muted-foreground">Loading models…</p>
  }
  if (models._tag === 'Failure') {
    const message = AsyncResult.matchWithError(models, {
      onInitial: () => 'ChatGPT models could not be loaded.',
      onError: (error) => error.message,
      onDefect: () => 'ChatGPT models could not be loaded.',
      onSuccess: () => 'ChatGPT models could not be loaded.',
    })
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Could not load models</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
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
