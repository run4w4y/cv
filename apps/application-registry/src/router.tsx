import {
  createBrowserRouter,
  createHashRouter,
  Navigate,
  type RouteObject,
} from 'react-router'
import { isDesktopHost } from './host/desktop'
import { AppShell } from './shell/app-shell'
import { staticBreadcrumbHandle } from './shell/breadcrumbs'
import { RouteErrorPage } from './shell/route-error-page'

export const registryRoutes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, element: <Navigate to="/applications" replace /> },
      {
        path: 'applications',
        handle: staticBreadcrumbHandle({
          key: 'applications',
          label: 'Applications',
        }),
        lazy: () => import('./applications/pages/applications'),
      },
      {
        path: 'activities',
        handle: staticBreadcrumbHandle({
          key: 'activities',
          label: 'Activities',
        }),
        lazy: () => import('./events/pages/events'),
      },
      {
        path: 'analytics',
        handle: staticBreadcrumbHandle({
          key: 'analytics',
          label: 'CV analytics',
        }),
        lazy: () => import('./analytics/pages/cv-analytics'),
      },
      {
        path: 'facts',
        handle: staticBreadcrumbHandle({
          key: 'facts',
          label: 'Reviewed facts',
        }),
        lazy: () => import('./facts/pages/facts'),
      },
      {
        path: 'workflows',
        lazy: () => import('./preparation/pages/workflows-dashboard'),
      },
      {
        path: 'workflows/new',
        lazy: () => import('./preparation/pages/new-workflow'),
      },
      {
        path: 'workflows/:batchId',
        lazy: () => import('./preparation/pages/workflow-batch'),
      },
      {
        path: 'workflows/:batchId/jobs/:jobId',
        lazy: () => import('./preparation/pages/workflow-job'),
      },
      {
        path: 'workflows/:batchId/jobs/:jobId/review',
        lazy: () => import('./preparation/pages/workflow-review'),
      },
      {
        path: 'workflows/:batchId/jobs/:jobId/artifacts/:kind/review',
        lazy: () => import('./preparation/pages/workflow-review'),
      },
      {
        path: 'applications/:applicationId',
        lazy: () => import('./applications/pages/application-details'),
      },
      {
        path: 'applications/:applicationId/artifacts/:artifactId',
        lazy: () => import('./applications/pages/application-artifact'),
      },
      {
        path: 'applications/:applicationId/prepare',
        lazy: () => import('./preparation/pages/cv-preparation'),
      },
      {
        path: 'applications/:applicationId/cover-letter',
        lazy: () => import('./preparation/pages/cover-letter'),
      },
      {
        path: 'applications/:applicationId/publish',
        lazy: () => import('./preparation/pages/cv-publication'),
      },
      {
        path: 'preparation/cv-guidance',
        handle: staticBreadcrumbHandle({
          key: 'cv-guidance',
          label: 'CV guidance',
        }),
        lazy: () => import('./preparation/pages/cv-guidance'),
      },
    ],
  },
]

export const router = isDesktopHost()
  ? createHashRouter(registryRoutes)
  : createBrowserRouter(registryRoutes)
