import { describe, expect, test } from 'bun:test'
import type { CompensationsCrud } from '@cv/application-registry-crud'
import { RegistryEventPublisherNoop } from '@cv/application-registry-events'
import { Effect, Layer } from 'effect'
import { application, compensation } from '../../test/support/fixtures'
import {
  applicationsCrudLayer,
  compensationsCrudLayer,
} from '../../test/support/layers'
import { CompensationsService } from '../services/compensations'
import { CompensationsServiceLive } from './compensations'

const live = (
  compensations = [compensation],
  overrides: Partial<CompensationsCrud> = {}
) =>
  CompensationsServiceLive.pipe(
    Layer.provide(applicationsCrudLayer()),
    Layer.provide(
      compensationsCrudLayer({
        listByApplication: () => Effect.succeed(compensations),
        ...overrides,
      })
    ),
    Layer.provide(RegistryEventPublisherNoop)
  )

describe('CompensationsService', () => {
  test('returns stored compensation values unchanged', async () => {
    const result = await Effect.runPromise(
      CompensationsService.use((service) =>
        service.listByApplication(application.id)
      ).pipe(Effect.provide(live()))
    )

    expect(result.items).toEqual([compensation])
  })

  test('replaces the selected annual value with an optimistic version check', async () => {
    let persisted: Parameters<CompensationsCrud['replaceAnnual']>[2] | undefined
    const result = await Effect.runPromise(
      CompensationsService.use((service) =>
        service.replaceAnnual(application.id, {
          annualCompensation: {
            currencyCode: 'USD',
            minimumMinor: 15_000_000,
            maximumMinor: 18_000_000,
          },
          expectedVersion: application.version,
        })
      ).pipe(
        Effect.provide(
          live([compensation], {
            replaceAnnual: (_applicationId, _expectedVersion, replacement) => {
              persisted = replacement
              return Effect.succeed(true)
            },
          })
        )
      )
    )

    expect(persisted).toMatchObject({
      currencyCode: 'USD',
      kind: 'base_salary',
      minimumMinor: 15_000_000,
      maximumMinor: 18_000_000,
      source: 'manual',
    })
    expect(result.annualCompensation?.currencyCode).toBe('USD')
  })
})
