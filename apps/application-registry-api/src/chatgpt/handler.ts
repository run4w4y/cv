import {
  createChatGPTHandler,
  type RateLimitBucket,
  type StoredSession,
} from '@opencoredev/loginwithchatgpt-server'

import type { ApplicationRegistryEnv } from '../worker/types'
import { CloudflareKvStore } from './kv-store'

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

export const handleChatGPTRequest = (
  request: Request,
  env: ApplicationRegistryEnv
): Promise<Response> => {
  const secret = env.CHATGPT_SESSION_SECRET?.trim()
  if (!secret) return Promise.resolve(configurationError())

  const auth = createChatGPTHandler({
    basePath,
    secret,
    sessionStore: new CloudflareKvStore<StoredSession>(
      env.CHATGPT_SESSIONS,
      'session'
    ),
    responsesProxy: {
      maxRequestBytes: 8 * 1_024 * 1_024,
      rateLimit: {
        limit: 30,
        store: new CloudflareKvStore<RateLimitBucket>(
          env.CHATGPT_SESSIONS,
          'responses-rate'
        ),
        windowMs: 60_000,
      },
    },
  })

  return auth.handler(request)
}
