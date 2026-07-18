import { Context } from 'effect'

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

export const makeWorkerRequestContext = (
  env: ApplicationRegistryEnv,
  context: WorkerExecutionContext
): Context.Context<unknown> =>
  // HttpRouter injects these services itself, while the web handler context
  // type is intentionally erased across its request-level dependency marker.
  Context.mergeAll(
    WorkerEnv.context(env),
    WorkerContext.context(context)
  ) as Context.Context<unknown>
