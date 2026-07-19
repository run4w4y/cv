import type { KVNamespace } from '@cloudflare/workers-types'
import {
  createChatGPTHandler,
  type KeyValueStore,
  type RateLimitBucket,
  type StoredSession,
} from '@opencoredev/loginwithchatgpt-server'
import { Context, Effect, Layer, Redacted, Schema } from 'effect'

export type {
  RateLimitBucket,
  StoredSession,
} from '@opencoredev/loginwithchatgpt-server'

export type ChatGPTServerOptions = {
  readonly basePath: string
  readonly rateLimitStore: KeyValueStore<RateLimitBucket>
  readonly sessionSecret: Redacted.Redacted<string>
  readonly sessionStore: KeyValueStore<StoredSession>
}

export interface ChatGPTServerShape {
  readonly handle: (
    request: Request
  ) => Effect.Effect<Response, ChatGPTServerError>
}

export class ChatGPTServer extends Context.Service<
  ChatGPTServer,
  ChatGPTServerShape
>()('@cv/ai-provider/ChatGPTServer') {}

export class ChatGPTServerError extends Schema.TaggedErrorClass<ChatGPTServerError>()(
  'ChatGPT.ServerError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

export const makeChatGPTServerLayer = (options: ChatGPTServerOptions) =>
  Layer.effect(
    ChatGPTServer,
    Effect.sync(() => {
      const handler = createChatGPTHandler({
        basePath: options.basePath,
        secret: Redacted.value(options.sessionSecret),
        sessionStore: options.sessionStore,
        responsesProxy: {
          maxRequestBytes: 8 * 1_024 * 1_024,
          rateLimit: {
            limit: 30,
            store: options.rateLimitStore,
            windowMs: 60_000,
          },
        },
      })

      return ChatGPTServer.of({
        handle: Effect.fn('ChatGPTServer.handle')((request: Request) =>
          Effect.tryPromise({
            try: () => handler.handler(request),
            catch: (cause) =>
              new ChatGPTServerError({
                cause,
                message:
                  cause instanceof Error
                    ? cause.message
                    : 'ChatGPT request failed.',
              }),
          })
        ),
      })
    })
  )

const minimumCloudflareKvTtlSeconds = 60

/** Cloudflare KV adapter for loginwithchatgpt's storage interface. */
export class CloudflareKvStore<T> implements KeyValueStore<T> {
  readonly #namespace: KVNamespace
  readonly #prefix: string

  constructor(namespace: KVNamespace, prefix: string) {
    this.#namespace = namespace
    this.#prefix = prefix
  }

  async get(key: string): Promise<T | undefined> {
    const value = await this.#namespace.get<T>(this.#key(key), 'json')
    return value ?? undefined
  }

  async set(
    key: string,
    value: T,
    options: { readonly ttlMs?: number } = {}
  ): Promise<void> {
    const expirationTtl =
      options.ttlMs === undefined
        ? undefined
        : Math.max(
            minimumCloudflareKvTtlSeconds,
            Math.ceil(options.ttlMs / 1_000)
          )

    await this.#namespace.put(this.#key(key), JSON.stringify(value), {
      expirationTtl,
    })
  }

  async delete(key: string): Promise<void> {
    await this.#namespace.delete(this.#key(key))
  }

  #key(key: string) {
    return `${this.#prefix}:${key}`
  }
}
