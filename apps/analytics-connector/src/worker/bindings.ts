import { Context, type Scope } from 'effect'
import type { HttpServerRequest } from 'effect/unstable/http'

import type { AnalyticsConnectorEnv, WorkerExecutionContext } from './types'

const missingWorkerBinding = (name: string): never => {
  throw new Error(
    `${name} was not provided to the analytics connector request.`
  )
}

export const WorkerEnv = Context.Reference<AnalyticsConnectorEnv>('WorkerEnv', {
  defaultValue: (): AnalyticsConnectorEnv => missingWorkerBinding('WorkerEnv'),
})

export const WorkerContext = Context.Reference<WorkerExecutionContext>(
  'WorkerContext',
  {
    defaultValue: (): WorkerExecutionContext =>
      missingWorkerBinding('WorkerContext'),
  }
)

type WebHandlerContext = HttpServerRequest.HttpServerRequest | Scope.Scope

export const makeWorkerRequestContext = (
  env: AnalyticsConnectorEnv,
  context: WorkerExecutionContext
): Context.Context<WebHandlerContext> =>
  // HttpRouter injects these two services itself, but its CORS middleware
  // signature still exposes them on the optional request context.
  Context.mergeAll(
    WorkerEnv.context(env),
    WorkerContext.context(context)
  ) as Context.Context<WebHandlerContext>
