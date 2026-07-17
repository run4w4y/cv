import { TooltipProvider } from '@cv/internal-ui'
import { RegistryProvider } from '@effect/atom-react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import './styles.css'

const root = document.querySelector('#root')

if (root === null) {
  throw new Error('Application root element was not found.')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <RegistryProvider>
      <TooltipProvider delay={400}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </RegistryProvider>
  </React.StrictMode>
)
