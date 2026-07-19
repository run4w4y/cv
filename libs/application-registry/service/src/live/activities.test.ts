import { describe, expect, test } from 'bun:test'
import type { ActivitiesCrud } from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'

import {
  application,
  activity,
  registryActivityListItem,
} from '../../test/support/fixtures'
import {
  activitiesCrudLayer,
  applicationsCrudLayer,
} from '../../test/support/layers'
import { ActivitiesService } from '../services/activities'
import { ActivitiesServiceLive } from './activities'

const live = (activityLayer = activitiesCrudLayer()) =>
  ActivitiesServiceLive.pipe(
    Layer.provide(applicationsCrudLayer()),
    Layer.provide(activityLayer)
  )

describe('ActivitiesService', () => {
  test('resolves and forwards activity filters', async () => {
    let observed: Parameters<ActivitiesCrud['list']>[0] | undefined
    const page = await Effect.runPromise(
      ActivitiesService.use((service) =>
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
              field: 'kind',
              operator: 'in',
              value: ['details_changed'],
            },
          ],
        })
      ).pipe(
        Effect.provide(
          live(
            activitiesCrudLayer({
              list: (query) => {
                observed = query
                return Effect.succeed({
                  items: [registryActivityListItem],
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

    expect(observed?.filtering.where).toBeDefined()
    expect(observed?.ordering.terms).toEqual([
      expect.objectContaining({ field: 'revision', direction: 'asc' }),
    ])
    expect(page.items[0]?.postingUrl).toBe(application.postingUrl)
  })

  test('returns backend-issued activities for one application', async () => {
    const result = await Effect.runPromise(
      ActivitiesService.use((service) =>
        service.listByApplication(application.id)
      ).pipe(
        Effect.provide(
          live(
            activitiesCrudLayer({
              listByApplication: () => Effect.succeed([activity]),
            })
          )
        )
      )
    )

    expect(result.items).toEqual([activity])
  })
})
