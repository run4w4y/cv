import { staticBreadcrumbHandle } from '@/shell/breadcrumbs'

export const handle = staticBreadcrumbHandle(
  { key: 'workflows', label: 'URL workflows', to: '/workflows' },
  { key: 'new-workflow', label: 'New workflow' }
)
