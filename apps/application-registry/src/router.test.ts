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
  test('keeps registry screens and adds both preparation flows plus schema inspection', () => {
    const paths = routePaths(registryRoutes)

    expect(paths).toContain('/applications')
    expect(paths).toContain('/applications/:applicationId')
    expect(paths).toContain('/applications/:applicationId/prepare')
    expect(paths).toContain('/applications/:applicationId/cover-letter')
    expect(paths).toContain('/schema/cv-document')
    expect(paths).toContain('/activities')
  })
})
