import { TooltipProvider } from '@cv/internal-ui'
import { RegistryProvider } from '@effect/atom-react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { HostBootstrap } from './host/bootstrap'
import { CvPublicationWorkflowProvider } from './preparation/publication'
import { PreparationWorkflowProvider } from './preparation/workflow/provider'
import { router } from './router'
import './styles.css'

const root = document.querySelector('#root')

if (root === null) {
  throw new Error('Application root element was not found.')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <RegistryProvider>
      <HostBootstrap>
        <TooltipProvider delay={400}>
          <PreparationWorkflowProvider>
            <CvPublicationWorkflowProvider>
              <RouterProvider router={router} />
            </CvPublicationWorkflowProvider>
          </PreparationWorkflowProvider>
        </TooltipProvider>
      </HostBootstrap>
    </RegistryProvider>
  </React.StrictMode>
)
