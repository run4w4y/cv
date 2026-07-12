import { describe, expect, test } from 'bun:test'
import { FxRates, type FxRatesShape } from '@cv/application-registry-fx'
import { Effect, Layer } from 'effect'
import { application, compensation, fxRate } from '../../test/support/fixtures'
import {
  applicationsCrudLayer,
  compensationsCrudLayer,
} from '../../test/support/layers'
import { CompensationsService } from '../services/compensations'
import { CompensationsServiceLive } from './compensations'

const live = (getRate: FxRatesShape['get'], compensations = [compensation]) =>
  CompensationsServiceLive.pipe(
    Layer.provide(applicationsCrudLayer()),
    Layer.provide(
      compensationsCrudLayer({
        listByApplication: () => Effect.succeed(compensations),
      })
    ),
    Layer.provide(Layer.succeed(FxRates, { get: getRate }))
  )

describe('CompensationsService', () => {
  test('does not request FX when no quote currency was supplied', async () => {
    let requests = 0
    const result = await Effect.runPromise(
      CompensationsService.use((service) =>
        service.listByApplication(application.id)
      ).pipe(
        Effect.provide(
          live(() => {
            requests += 1
            return Effect.succeed(fxRate)
          })
        )
      )
    )

    expect(requests).toBe(0)
    expect(result.items).toEqual([{ conversion: null, original: compensation }])
  })

  test('deduplicates currency pairs before converting values', async () => {
    let requests = 0
    const second = { ...compensation, id: 'compensation-2' }
    const result = await Effect.runPromise(
      CompensationsService.use((service) =>
        service.listByApplication(application.id, 'USD')
      ).pipe(
        Effect.provide(
          live(() => {
            requests += 1
            return Effect.succeed(fxRate)
          }, [compensation, second])
        )
      )
    )

    expect(requests).toBe(1)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]?.conversion?.currencyCode).toBe('USD')
  })
})
