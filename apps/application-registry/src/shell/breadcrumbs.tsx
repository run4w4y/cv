import * as React from 'react'
import type { UIMatch } from 'react-router'

export type RegistryBreadcrumb = {
  readonly key: string
  readonly label: React.ReactNode
  readonly to?: string
}

export type RegistryRouteHandle = {
  readonly breadcrumbs: (match: UIMatch) => ReadonlyArray<RegistryBreadcrumb>
  readonly managesDocumentTitle?: boolean
}

export const staticBreadcrumbHandle = (
  ...breadcrumbs: ReadonlyArray<RegistryBreadcrumb>
): RegistryRouteHandle => ({
  breadcrumbs: () => breadcrumbs,
})

export const isRegistryRouteHandle = (
  handle: unknown
): handle is RegistryRouteHandle =>
  typeof handle === 'object' &&
  handle !== null &&
  'breadcrumbs' in handle &&
  typeof handle.breadcrumbs === 'function'

export const registryDocumentTitle = (title: string): string =>
  title === 'Applications'
    ? 'Application Registry'
    : `${title} — Application Registry`

export const useRegistryDocumentTitle = (title: string | null) => {
  React.useEffect(() => {
    if (title === null) return
    document.title = registryDocumentTitle(title)
  }, [title])
}
