export const campaignWorkflowStepIds = {
  profiles: 'profiles',
  runArtifacts: 'run-artifacts',
  targets: 'targets',
  target: {
    fetchJob: 'fetch-job',
    privateLink: 'private-link',
    privatePdf: 'private-pdf',
    recommend: 'recommend',
    writeArtifacts: 'write-artifacts',
  },
} as const

export const targetWorkflowStepId = (targetIndex: number, id: string) =>
  `target:${targetIndex}:${id}`
