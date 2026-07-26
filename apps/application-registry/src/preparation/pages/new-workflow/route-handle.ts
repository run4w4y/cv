import { staticBreadcrumbHandle } from '@/shell/breadcrumbs'

export const handle = staticBreadcrumbHandle(
  { key: 'workflows', label: 'AI workflows', to: '/ai-workflows' },
  { key: 'new-workflow', label: 'New workflow' }
)
