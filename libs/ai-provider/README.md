# `@cv/ai-provider`

One-shot, schema-constrained AI generation for the management browser.

The live adapter uses only `createChatGPTProxyProvider` from
`@opencoredev/loginwithchatgpt-ai`. It calls the application-owned
`/api/chatgpt` proxy with its session cookie. There is no API-key option, no
direct-token provider, and no OpenAI API billing path in this package. Raw
ChatGPT tokens remain in the server-side auth/session handler.

The core package has no CV document or facts dependency. A caller supplies a
prompt, model ID, and JSON Schema for every independent request. The package
does not accept conversation IDs or retain messages between calls. The proxy
transport also normalizes Responses API calls to stateless `store: false`
operation.

## Usage

```ts
import { AiProvider } from '@cv/ai-provider'
import { makeChatGptSubscriptionAiProviderLayer } from '@cv/ai-provider/live'
import { Effect } from 'effect'

type Draft = { readonly headline: string }

const program = Effect.gen(function* () {
  const ai = yield* AiProvider
  const models = yield* ai.discoverModels()
  const model = models[0]
  if (!model) return null

  return yield* ai.generateJson<Draft>({
    modelId: model.id,
    prompt: 'Write a concise headline.',
    schemaName: 'draft',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { headline: { type: 'string' } },
      required: ['headline'],
    },
  })
}).pipe(Effect.provide(makeChatGptSubscriptionAiProviderLayer()))
```

`generateJson` sends the schema as an AI SDK v7 structured-output response
format and validates the returned JSON locally with AJV before succeeding.
Caller `AbortSignal` cancellation is typed as `AiProviderCancellationError`;
Effect interruption aborts the underlying browser request normally.

For deterministic tests, use `makeInMemoryAiProvider` from
`@cv/ai-provider/test-support`.
