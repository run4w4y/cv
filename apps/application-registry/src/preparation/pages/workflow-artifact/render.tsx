import { useParams } from 'react-router'
import { WorkflowNotFound } from '../../workflows/not-found'
import {
  CoverLetterWorkspacePage,
  CvPreparationWorkspacePage,
} from '../artifact-workspace'

const workflowJobHref = (batchId: string, jobId: string): string =>
  `/ai-workflows/${encodeURIComponent(batchId)}/jobs/${encodeURIComponent(jobId)}`

export const WorkflowArtifactPage = () => {
  const { batchId = '', jobId = '', kind } = useParams()

  if (kind !== 'cv' && kind !== 'cover-letter') {
    return (
      <WorkflowNotFound
        title="Document workspace unavailable"
        description="This AI workflow does not recognize the requested artifact kind."
      />
    )
  }

  const backTo = workflowJobHref(batchId, jobId)
  const props = { backTo, batchId, jobId }

  return kind === 'cv' ? (
    <CvPreparationWorkspacePage {...props} />
  ) : (
    <CoverLetterWorkspacePage {...props} />
  )
}
