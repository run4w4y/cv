import { describe, expect, test } from 'bun:test'
import type { RouteObject } from 'react-router'

import { registryRoutes } from './router'
import { isRegistryRouteHandle } from './shell/breadcrumbs'

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
  test('exposes one AI-workflow hierarchy without legacy document routes', () => {
    const paths = routePaths(registryRoutes)

    expect(paths).toContain('/applications')
    expect(paths).toContain('/applications/:applicationId')
    expect(paths).toContain(
      '/applications/:applicationId/artifacts/:artifactId'
    )
    expect(paths).toContain('/facts')
    expect(paths).toContain('/ai-workflows')
    expect(paths).toContain('/ai-workflows/new')
    expect(paths).toContain('/ai-workflows/:batchId')
    expect(paths).toContain('/ai-workflows/:batchId/jobs/:jobId')
    expect(paths).toContain(
      '/ai-workflows/:batchId/jobs/:jobId/artifacts/:kind'
    )
    expect(paths).not.toContain('/workflows')
    expect(paths).not.toContain('/applications/:applicationId/prepare')
    expect(paths).not.toContain('/applications/:applicationId/cover-letter')
    expect(paths).not.toContain('/applications/:applicationId/publish')
    expect(paths).not.toContain('/ai-workflows/:batchId/jobs/:jobId/review')
    expect(paths).toContain('/preparation/cv-guidance')
    expect(paths).not.toContain('/preparation/batch')
    expect(paths).not.toContain('/schema/cv-document')
    expect(paths).toContain('/activities')
  })

  test('gives every user-facing route breadcrumb metadata', async () => {
    const routes = registryRoutes[0]?.children ?? []
    for (const route of routes) {
      if (route.index === true || route.path === undefined) continue
      if (isRegistryRouteHandle(route.handle)) continue
      const lazyRoute =
        typeof route.lazy === 'function' ? await route.lazy() : null
      expect(
        isRegistryRouteHandle(lazyRoute?.handle),
        `${route.path} should define breadcrumb metadata`
      ).toBe(true)
    }
  })
})
