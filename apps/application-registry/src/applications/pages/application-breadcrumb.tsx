import { useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'

import type { RegistryRouteHandle } from '@/shell/breadcrumbs'
import { useRegistryDocumentTitle } from '@/shell/breadcrumbs'
import { applicationAtom } from '../data'

const applicationLabel = (
  application: { readonly company: string; readonly role: string } | undefined,
  applicationId: string
): string =>
  application === undefined
    ? `Application ${applicationId.slice(0, 8)}`
    : `${application.role} · ${application.company}`

const ApplicationBreadcrumbLabel = ({
  applicationId,
  pageTitle,
}: {
  readonly applicationId: string
  readonly pageTitle: string | null
}) => {
  const result = useAtomValue(applicationAtom(applicationId))
  const application = AsyncResult.getOrElse(result, () => undefined)
  const label = applicationLabel(application, applicationId)
  useRegistryDocumentTitle(
    pageTitle === null ? label : `${pageTitle} — ${label}`
  )
  return label
}

export const applicationBreadcrumbHandle = (
  page: null | {
    readonly key: string
    readonly label: string
  }
): RegistryRouteHandle => ({
  managesDocumentTitle: true,
  breadcrumbs: (match) => {
    const applicationId = match.params.applicationId ?? ''
    const applicationPath = `/applications/${encodeURIComponent(applicationId)}`
    return [
      { key: 'applications', label: 'Applications', to: '/applications' },
      {
        key: 'application',
        label: (
          <ApplicationBreadcrumbLabel
            applicationId={applicationId}
            pageTitle={page?.label ?? null}
          />
        ),
        ...(page === null ? {} : { to: applicationPath }),
      },
      ...(page === null ? [] : [{ key: page.key, label: page.label }]),
    ]
  },
})
