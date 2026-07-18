export const mergeAbortSignals = (
  ...signals: ReadonlyArray<AbortSignal | null | undefined>
): AbortSignal | undefined => {
  const present: Array<AbortSignal> = []
  for (const signal of signals) {
    if (signal) {
      present.push(signal)
    }
  }

  if (present.length === 0) {
    return undefined
  }
  if (present.length === 1) {
    return present[0]
  }
  return AbortSignal.any(present)
}

export const isAbortFailure = (cause: unknown) =>
  cause instanceof DOMException
    ? cause.name === 'AbortError'
    : cause instanceof Error && cause.name === 'AbortError'
