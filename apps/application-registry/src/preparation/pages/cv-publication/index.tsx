import { applicationBreadcrumbHandle } from '../../../applications/pages/application-breadcrumb'
import { CvPublicationWorkflowProvider } from '../../publication/provider'
import { CvPublicationPage as Page } from './render'

export const CvPublicationPage = () => (
  <CvPublicationWorkflowProvider>
    <Page />
  </CvPublicationWorkflowProvider>
)

export const Component = CvPublicationPage

export const handle = applicationBreadcrumbHandle({
  key: 'publish-cv',
  label: 'Publish CV',
})
