import type { D1Database } from '@cloudflare/workers-types'
import { Effect } from 'effect'
import {
  type RegistryServiceTestEnv,
  registryServiceTestLayer,
} from './support/worker-runtime'
import {
  concurrentCapturesWorkflow,
  concurrentNoteWorkflow,
  concurrentUpsertsWorkflow,
  lifecycleRaceWorkflow,
  optimisticPatchRaceWorkflow,
} from './workflows/concurrency'
import {
  applicationWorkflow,
  captureMergeWorkflow,
  compensationWorkflow,
  defaultsWorkflow,
  eventWorkflow,
  noteAndCaptureWorkflow,
  patchNullabilityWorkflow,
} from './workflows/core'
import { rollbackWorkflow } from './workflows/persistence'

const response = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  database: D1Database
) =>
  effect.pipe(
    Effect.provide(registryServiceTestLayer(database)),
    Effect.map((value): unknown => value)
  )

const route = (pathname: string, database: D1Database) => {
  switch (pathname) {
    case '/workflows/application':
      return response(applicationWorkflow, database)
    case '/workflows/capture-merge':
      return response(captureMergeWorkflow, database)
    case '/workflows/compensation':
      return response(compensationWorkflow, database)
    case '/workflows/concurrent-captures':
      return response(concurrentCapturesWorkflow, database)
    case '/workflows/concurrent-note':
      return response(concurrentNoteWorkflow, database)
    case '/workflows/concurrent-upserts':
      return response(concurrentUpsertsWorkflow, database)
    case '/workflows/defaults':
      return response(defaultsWorkflow, database)
    case '/workflows/event':
      return response(eventWorkflow, database)
    case '/workflows/lifecycle-race':
      return response(lifecycleRaceWorkflow, database)
    case '/workflows/note-and-capture':
      return response(noteAndCaptureWorkflow, database)
    case '/workflows/optimistic-patch-race':
      return response(optimisticPatchRaceWorkflow, database)
    case '/workflows/patch-nullability':
      return response(patchNullabilityWorkflow, database)
    case '/workflows/rollback':
      return response(rollbackWorkflow(database), database)
    default:
      return response(Effect.succeed({ ok: true }), database)
  }
}

export default {
  async fetch(request: Request, env: RegistryServiceTestEnv) {
    const result = await Effect.runPromiseExit(
      route(new URL(request.url).pathname, env.APPLICATION_REGISTRY_DB)
    )

    return result._tag === 'Success'
      ? Response.json(result.value)
      : Response.json({ error: result.cause.toString() }, { status: 500 })
  },
}
