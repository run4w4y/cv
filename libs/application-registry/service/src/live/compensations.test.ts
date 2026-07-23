import { describe, expect, test } from 'bun:test'
import type { CompensationsCrud } from '@cv/application-registry-crud'
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
    )
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
})
