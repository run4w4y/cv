import type { D1Database } from '@cloudflare/workers-types'
import { Effect, Result } from 'effect'

import { AnnotationsService, ApplicationsService } from '../../src'
import { makeApplicationInput } from '../support/worker-runtime'

const firstRow = <Row>(database: D1Database, sql: string) =>
  Effect.promise(() => database.prepare(sql).first<Row>())

export const rollbackWorkflow = (database: D1Database) =>
  Effect.gen(function* () {
    const annotations = yield* AnnotationsService
    const applications = yield* ApplicationsService
    const application = yield* applications.upsert(
      makeApplicationInput('receipt-rollback')
    )
    const before = yield* firstRow<{ revision: number }>(
      database,
      'select revision from registry_sequence where id = 1'
    )
    if (before === null) {
      return yield* Effect.die(
        new Error('The registry revision row was not initialized.')
      )
    }

    yield* Effect.promise(() =>
      database
        .prepare(`
          create trigger fail_service_receipt
          before insert on command_receipts
          when new.operation_id = 'service:rollback'
          begin
            select raise(abort, 'forced service integration rollback');
          end
        `)
        .run()
    )

    const result = yield* Effect.result(
      annotations.addNote(application.id, {
        body: 'This note must be rolled back.',
        kind: 'general',
        operationId: 'service:rollback',
        source: 'service-integration',
      })
    )
    const [notes, receipts, events, after] = yield* Effect.all([
      firstRow<{ count: number }>(
        database,
        `select count(*) as count
           from application_notes
          where body = 'This note must be rolled back.'`
      ),
      firstRow<{ count: number }>(
        database,
        `select count(*) as count
           from command_receipts
          where operation_id = 'service:rollback'`
      ),
      firstRow<{ count: number }>(
        database,
        `select count(*) as count
           from application_events
          where application_id = '${application.id}'
            and kind = 'note_added'`
      ),
      firstRow<{ revision: number }>(
        database,
        'select revision from registry_sequence where id = 1'
      ),
    ])

    return {
      afterRevision: after?.revision ?? null,
      beforeRevision: before.revision,
      eventCount: events?.count ?? -1,
      failureTag: Result.isFailure(result) ? result.failure._tag : null,
      noteCount: notes?.count ?? -1,
      receiptCount: receipts?.count ?? -1,
    }
  })
