import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
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
      { path: 'events', lazy: () => import('./events/pages/events') },
      { path: 'analytics', lazy: () => import('./analytics/pages/cv-analytics') },
      {
        path: 'preparation/batch',
        lazy: () => import('./preparation/pages/batch-preparation'),
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
        path: 'schema/cv-document',
        lazy: () => import('./preparation/pages/schema-inspector'),
      },
    ],
  },
]

export const router = createBrowserRouter(registryRoutes)
