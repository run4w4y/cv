import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@cv/internal-ui'
import { GitBranch } from 'lucide-react'
import { Link } from 'react-router'

import { WorkflowPage } from './components'

export const WorkflowNotFound = ({
  description,
  title,
}: {
  readonly description: string
  readonly title: string
}) => (
  <WorkflowPage>
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <GitBranch />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link to="/workflows" />}>All workflows</Button>
      </EmptyContent>
    </Empty>
  </WorkflowPage>
)
