import {
  createBrowserRouter,
  createHashRouter,
  Navigate,
  type RouteObject,
} from 'react-router'
import { isDesktopHost } from './host/desktop'
import { AppShell } from './shell/app-shell'
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
        lazy: () => import('./applications/pages/applications'),
      },
      { path: 'activities', lazy: () => import('./events/pages/events') },
      {
        path: 'analytics',
        lazy: () => import('./analytics/pages/cv-analytics'),
      },
      {
        path: 'facts',
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
        path: 'workflows/:batchId/jobs/:runId',
        lazy: () => import('./preparation/pages/workflow-job'),
      },
      {
        path: 'workflows/:batchId/jobs/:runId/review',
        lazy: () => import('./preparation/pages/workflow-review'),
      },
      {
        path: 'applications/:applicationId',
        lazy: () => import('./applications/pages/application-details'),
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
        lazy: () => import('./preparation/pages/cv-guidance'),
      },
    ],
  },
]

export const router = isDesktopHost()
  ? createHashRouter(registryRoutes)
  : createBrowserRouter(registryRoutes)
