import { describe, expect, test } from 'bun:test'

import { makeRegistryFactory } from './factories'
import { seedRegistryThroughService } from './seed'

describe('registry factories', () => {
  test('replays domain inputs from the same seed', () => {
    const first = makeRegistryFactory({ seed: 42 })
    const second = makeRegistryFactory({ seed: 42 })

    expect(first.application()).toEqual(second.application())
  })

  test('builds a connected bulk graph with stable counts', () => {
    const graph = makeRegistryFactory({ seed: 73 }).graph({
      applicationCount: 12,
      activitiesPerApplication: 2,
    })

    expect(graph.applications).toHaveLength(12)
    expect(graph.activities).toHaveLength(24)
    expect(new Set(graph.applications.map(({ id }) => id)).size).toBe(12)
    expect(
      graph.activities.every(({ applicationId }) =>
        graph.applications.some(({ id }) => id === applicationId)
      )
    ).toBe(true)
  })

  test('seeds generated applications through a behavior boundary', async () => {
    const persisted: string[] = []
    const seeded = await seedRegistryThroughService({
      applicationCount: 5,
      concurrency: 2,
      factory: makeRegistryFactory({ seed: 91 }),
      persist: async (input) => {
        persisted.push(input.postingUrl)
        return input.company
      },
    })

    expect(seeded.inputs).toHaveLength(5)
    expect(seeded.results).toHaveLength(5)
    expect(persisted).toEqual(seeded.inputs.map(({ postingUrl }) => postingUrl))
  })
})
