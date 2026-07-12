import { Context, type Scope } from 'effect'
import type { HttpServerRequest } from 'effect/unstable/http'

import type { ApplicationRegistryEnv, WorkerExecutionContext } from './types'

const missingWorkerBinding = (name: string): never => {
  throw new Error(`${name} was not provided to the registry API request.`)
}

export const WorkerEnv = Context.Reference<ApplicationRegistryEnv>(
  'ApplicationRegistryWorkerEnv',
  {
    defaultValue: () => missingWorkerBinding('WorkerEnv'),
  }
)

export const WorkerContext = Context.Reference<WorkerExecutionContext>(
  'ApplicationRegistryWorkerContext',
  {
    defaultValue: () => missingWorkerBinding('WorkerContext'),
  }
)

type WebHandlerContext = HttpServerRequest.HttpServerRequest | Scope.Scope

export const makeWorkerRequestContext = (
  env: ApplicationRegistryEnv,
  context: WorkerExecutionContext
): Context.Context<WebHandlerContext> =>
  // HttpRouter injects these services itself, while the web handler context
  // type only exposes the router-owned request services.
  Context.mergeAll(
    WorkerEnv.context(env),
    WorkerContext.context(context)
  ) as Context.Context<WebHandlerContext>
