import {
  ChatGPTServer,
  CloudflareKvStore,
  makeChatGPTServerLayer,
  type RateLimitBucket,
  type StoredSession,
} from '@cv/ai-provider/chatgpt-server'
import { Effect } from 'effect'

import {
  provideWorkerConfiguration,
  readChatGPTSessionSecret,
} from '../worker/config'
import type { ApplicationRegistryEnv } from '../worker/types'

const basePath = '/api/chatgpt'

const configurationError = () =>
  Response.json(
    {
      code: 'chatgpt_auth_unavailable',
      message: 'ChatGPT subscription authentication is not configured.',
    },
    { status: 503 }
  )

export const isChatGPTRequest = (request: Request) =>
  new URL(request.url).pathname.startsWith(`${basePath}/`)

export const handleChatGPTRequestEffect = Effect.fn('ChatGPT.handleRequest')(
  function* (request: Request, env: ApplicationRegistryEnv) {
    const sessionSecret = yield* readChatGPTSessionSecret
    const server = yield* ChatGPTServer.pipe(
      Effect.provide(
        makeChatGPTServerLayer({
          basePath,
          rateLimitStore: new CloudflareKvStore<RateLimitBucket>(
            env.CHATGPT_SESSIONS,
            'responses-rate'
          ),
          sessionSecret,
          sessionStore: new CloudflareKvStore<StoredSession>(
            env.CHATGPT_SESSIONS,
            'session'
          ),
        })
      )
    )
    return yield* server.handle(request)
  }
)

export const handleChatGPTRequest = (
  request: Request,
  env: ApplicationRegistryEnv
): Promise<Response> =>
  handleChatGPTRequestEffect(request, env).pipe(
    provideWorkerConfiguration(env),
    Effect.catchTag('Worker.ConfigurationError', () =>
      Effect.succeed(configurationError())
    ),
    Effect.runPromise
  )
