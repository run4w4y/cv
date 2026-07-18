import type {
  AiJsonGenerationRequest,
  AiJsonGenerationResult,
  AiModel,
} from '@cv/ai-provider'
import { makeChatGptSubscriptionAiProvider } from '@cv/ai-provider/live'
import { Effect } from 'effect'

const browserAiProvider = makeChatGptSubscriptionAiProvider({
  basePath: '/api/chatgpt',
})

export const discoverChatGptModels = (
  signal?: AbortSignal
): Promise<ReadonlyArray<AiModel>> =>
  Effect.runPromise(browserAiProvider.discoverModels({ signal }))

export const generateChatGptJson = <Output>(
  request: AiJsonGenerationRequest
): Promise<AiJsonGenerationResult<Output>> =>
  Effect.runPromise(browserAiProvider.generateJson<Output>(request))
