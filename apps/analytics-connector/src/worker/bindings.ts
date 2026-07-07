import { Context } from 'effect'

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

export const makeWorkerRequestContext = (
  env: AnalyticsConnectorEnv,
  context: WorkerExecutionContext
): Context.Context<any> =>
  Context.mergeAll(
    WorkerEnv.context(env),
    WorkerContext.context(context)
  ) as Context.Context<any>
