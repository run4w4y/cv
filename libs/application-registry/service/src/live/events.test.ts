import { describe, expect, test } from 'bun:test'
import type { EventsCrud } from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'
import {
  application,
  event,
  registryEventListItem,
} from '../../test/support/fixtures'
import {
  applicationsCrudLayer,
  eventsCrudLayer,
  operationsCrudLayer,
} from '../../test/support/layers'
import { EventsService } from '../services/events'
import type { AppendApplicationEventInput } from '../types'
import { EventsServiceLive } from './events'

const request = (
  input: { readonly expectedVersion?: number | null } = {}
): AppendApplicationEventInput => ({
  deviceId: 'test',
  expectedVersion: application.version,
  kind: 'research_updated',
  occurredAt: event.occurredAt,
  operationId: event.operationId,
  payload: {},
  ...input,
})

const statusRequest = (): AppendApplicationEventInput => ({
  deviceId: 'test',
  expectedVersion: application.version,
  kind: 'stage_changed',
  nextApplicationStatus: 'technical_screen',
  occurredAt: event.occurredAt,
  operationId: event.operationId,
  payload: {},
})

const live = (
  applicationLayer = applicationsCrudLayer(),
  eventLayer = eventsCrudLayer({
    findByOperation: () => Effect.succeed(event),
  })
) =>
  EventsServiceLive.pipe(
    Layer.provide(applicationLayer),
    Layer.provide(eventLayer),
    Layer.provide(operationsCrudLayer())
  )

describe('EventsService', () => {
  test('forwards dashboard filters after decoding the event cursor', async () => {
    let observed: Parameters<EventsCrud['list']>[0] | undefined
    const page = await Effect.runPromise(
      EventsService.use((service) =>
        service.list({
          filters: [
            {
              type: 'condition',
              field: 'revision',
              operator: 'gt',
              value: 3,
            },
            {
              type: 'condition',
              field: 'occurredAt',
              operator: 'gte',
              value: '2026-07-01T00:00:00.000Z',
            },
            {
              type: 'condition',
              field: 'kind',
              operator: 'in',
              value: ['stage_changed', 'research_updated'],
            },
            {
              type: 'condition',
              field: 'occurredAt',
              operator: 'lte',
              value: '2026-07-31T23:59:59.999Z',
            },
          ],
        })
      ).pipe(
        Effect.provide(
          live(
            applicationsCrudLayer(),
            eventsCrudLayer({
              list: (query) => {
                observed = query
                return Effect.succeed({
                  items: [registryEventListItem],
                  pageInfo: {
                    kind: 'cursor',
                    size: 50,
                    hasNextPage: false,
                    hasPreviousPage: false,
                    nextCursor: null,
                  },
                })
              },
            })
          )
        )
      )
    )

    expect(observed?.cursorState).toBeUndefined()
    expect(observed?.filtering.where).toBeDefined()
    expect(observed?.ordering.terms).toEqual([
      expect.objectContaining({ field: 'revision', direction: 'asc' }),
    ])
    expect(observed?.pagination.size).toBe(50)
    expect(page.items[0]?.company).toBe(application.company)
  })

  test('forwards the numeric page size and exposes the next cursor', async () => {
    let observedSize: number | undefined
    const page = await Effect.runPromise(
      EventsService.use((service) =>
        service.list({ pagination: { size: 100 } })
      ).pipe(
        Effect.provide(
          live(
            applicationsCrudLayer(),
            eventsCrudLayer({
              list: (filter) => {
                observedSize = filter.pagination?.size
                return Effect.succeed({
                  items: [registryEventListItem],
                  pageInfo: {
                    kind: 'cursor',
                    size: 100,
                    hasNextPage: true,
                    hasPreviousPage: false,
                    nextCursor: 'inner-next',
                  },
                })
              },
            })
          )
        )
      )
    )

    expect(observedSize).toBe(100)
    expect(page.items).toHaveLength(1)
    expect(page.pageInfo.nextCursor).toBe('inner-next')
  })

  test('leaves status unchanged when no transition is requested', async () => {
    let observedStatus: string | undefined = 'not-called'
    const result = await Effect.runPromise(
      EventsService.use((service) =>
        service.append(application.id, request())
      ).pipe(
        Effect.provide(
          live(
            applicationsCrudLayer({
              persistEvent: (_applicationId, _expectedVersion, nextStatus) => {
                observedStatus = nextStatus
                return Effect.succeed(true)
              },
            })
          )
        )
      )
    )

    expect(result.replayed).toBe(false)
    expect(observedStatus).toBeUndefined()
  })

  test('passes an explicit status transition to persistence', async () => {
    let observedStatus: string | undefined
    await Effect.runPromise(
      EventsService.use((service) =>
        service.append(application.id, statusRequest())
      ).pipe(
        Effect.provide(
          live(
            applicationsCrudLayer({
              persistEvent: (_applicationId, _expectedVersion, nextStatus) => {
                observedStatus = nextStatus
                return Effect.succeed(true)
              },
            })
          )
        )
      )
    )

    expect(observedStatus).toBe('technical_screen')
  })

  test('rejects stale event versions before persistence', async () => {
    let persisted = false
    const error = await Effect.runPromise(
      EventsService.use((service) =>
        service.append(application.id, request({ expectedVersion: 99 }))
      ).pipe(
        Effect.flip,
        Effect.provide(
          live(
            applicationsCrudLayer({
              persistEvent: () => {
                persisted = true
                return Effect.succeed(true)
              },
            })
          )
        )
      )
    )

    expect(error._tag).toBe('RegistryConflictError')
    expect(persisted).toBe(false)
  })
})
