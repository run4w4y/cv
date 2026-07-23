import { CvPublicationWorkflowProvider } from '../../publication/provider'
import { CvPreparationPage as Page } from './render'

export const CvPreparationPage = () => (
  <CvPublicationWorkflowProvider>
    <Page />
  </CvPublicationWorkflowProvider>
)

export const Component = CvPreparationPage
