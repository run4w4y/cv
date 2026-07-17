import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from './shell/app-shell'
import { RouteErrorPage } from './shell/route-error-page'

export const router = createBrowserRouter([
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
      {
        path: 'applications/:applicationId',
        lazy: () => import('./applications/pages/application-details'),
      },
    ],
  },
])
