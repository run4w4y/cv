import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { application, event } from '../../test/support/fixtures'
import {
  applicationsCrudLayer,
  eventsCrudLayer,
  operationsCrudLayer,
  registryIdsLayer,
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
    Layer.provide(operationsCrudLayer()),
    Layer.provide(registryIdsLayer([event.id]))
  )

describe('EventsService', () => {
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
