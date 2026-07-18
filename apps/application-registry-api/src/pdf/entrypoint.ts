import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers'

import {
  type PdfWorkflowEnvironment,
  type PdfWorkflowParams,
  runPdfWorkflow,
} from './workflow'

export class CvPdfWorkflow extends WorkflowEntrypoint<
  PdfWorkflowEnvironment,
  PdfWorkflowParams
> {
  override run(
    event: Readonly<WorkflowEvent<PdfWorkflowParams>>,
    step: WorkflowStep
  ) {
    return runPdfWorkflow(this.env, event, step)
  }
}
