import { describe, expect, test } from 'bun:test'
import type { RouteObject } from 'react-router'

import { registryRoutes } from './router'

const routePaths = (
  routes: ReadonlyArray<RouteObject>,
  parent = ''
): ReadonlyArray<string> =>
  routes.flatMap((route) => {
    const current = route.path
      ? `${parent}/${route.path}`.replace(/\/{2,}/gu, '/')
      : parent
    return [current, ...routePaths(route.children ?? [], current)]
  })

describe('management route wiring', () => {
  test('keeps registry screens and exposes the workflow hierarchy', () => {
    const paths = routePaths(registryRoutes)

    expect(paths).toContain('/applications')
    expect(paths).toContain('/applications/:applicationId')
    expect(paths).toContain('/applications/:applicationId/prepare')
    expect(paths).toContain('/applications/:applicationId/cover-letter')
    expect(paths).toContain('/applications/:applicationId/publish')
    expect(paths).toContain('/facts')
    expect(paths).toContain('/workflows')
    expect(paths).toContain('/workflows/new')
    expect(paths).toContain('/workflows/:batchId')
    expect(paths).toContain('/workflows/:batchId/jobs/:runId')
    expect(paths).toContain('/workflows/:batchId/jobs/:runId/review')
    expect(paths).toContain('/preparation/cv-guidance')
    expect(paths).not.toContain('/preparation/batch')
    expect(paths).not.toContain('/schema/cv-document')
    expect(paths).toContain('/activities')
  })
})
