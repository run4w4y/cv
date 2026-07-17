import * as React from 'react'

export const useDebouncedDraft = <Value>(
  source: Value,
  delay: number,
  onCommit: (value: Value) => void
) => {
  const [draft, setDraft] = React.useState(source)

  // Browser history can change the source independently through back/forward.
  React.useEffect(() => setDraft(source), [source])

  // A timer is an external synchronization boundary. Keeping it here prevents
  // page components from accumulating lifecycle bookkeeping.
  React.useEffect(() => {
    if (Object.is(draft, source)) return
    const timeout = window.setTimeout(() => onCommit(draft), delay)
    return () => window.clearTimeout(timeout)
  }, [delay, draft, onCommit, source])

  return [draft, setDraft] as const
}
