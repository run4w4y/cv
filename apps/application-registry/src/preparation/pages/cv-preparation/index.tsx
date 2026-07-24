import { applicationBreadcrumbHandle } from '../../../applications/pages/application-breadcrumb'
import { CvPublicationWorkflowProvider } from '../../publication/provider'
import { CvPreparationPage as Page } from './render'

export const CvPreparationPage = () => (
  <CvPublicationWorkflowProvider>
    <Page />
  </CvPublicationWorkflowProvider>
)

export const Component = CvPreparationPage

export const handle = applicationBreadcrumbHandle({
  key: 'prepare-cv',
  label: 'Prepare CV',
})
