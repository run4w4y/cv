import { CvPublicationWorkflowProvider } from '../../publication/provider'
import { CvPublicationPage as Page } from './render'

export const CvPublicationPage = () => (
  <CvPublicationWorkflowProvider>
    <Page />
  </CvPublicationWorkflowProvider>
)

export const Component = CvPublicationPage
