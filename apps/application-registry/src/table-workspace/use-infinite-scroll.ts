import * as React from 'react'

export const useInfiniteScroll = ({
  enabled,
  onLoadMore,
  rootMargin,
}: {
  readonly enabled: boolean
  readonly onLoadMore: () => void
  readonly rootMargin: string
}) => {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  // IntersectionObserver is an external browser subscription. This is the one
  // effect the table needs; all table data and column derivations stay in render.
  React.useEffect(() => {
    const root = rootRef.current
    const target = sentinelRef.current
    if (
      root === null ||
      target === null ||
      !enabled ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      { root, rootMargin }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [enabled, onLoadMore, rootMargin])

  return { rootRef, sentinelRef }
}
