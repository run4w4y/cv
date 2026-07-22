import { Alert, AlertDescription, AlertTitle, Button } from '@cv/internal-ui'
import { Laptop, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { WorkflowPage, WorkflowPageHeader } from './components'

export const WorkflowDesktopUnavailable = () => (
  <WorkflowPage>
    <WorkflowPageHeader
      title="URL workflows"
      description="Parallel preparation uses the native Codex installation available to the desktop registry."
    />
    <Alert>
      <Sparkles />
      <AlertTitle>Open this workflow in the desktop app</AlertTitle>
      <AlertDescription className="grid gap-4">
        <span>
          AI execution is intentionally excluded from the hosted registry.
          Existing applications and manually editable documents remain available
          there.
        </span>
        <Button
          className="w-fit"
          variant="outline"
          render={<Link to="/applications" />}
        >
          <Laptop />
          Return to applications
        </Button>
      </AlertDescription>
    </Alert>
  </WorkflowPage>
)
