export const createOperationId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `operation-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export type OperationSubmission = {
  readonly fingerprint: string
  readonly operationId: string
}

export const operationSubmissionFor = (
  current: OperationSubmission | undefined,
  command: unknown
): OperationSubmission => {
  const fingerprint = JSON.stringify(command)
  if (current?.fingerprint === fingerprint) return current
  return { fingerprint, operationId: createOperationId() }
}
