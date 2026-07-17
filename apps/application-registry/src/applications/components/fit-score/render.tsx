import { cn } from '@cv/internal-ui'

const fitScoreSteps = [20, 40, 60, 80, 100] as const

export const describeFitScore = (score: number) => {
  if (score >= 90)
    return {
      label: 'Excellent',
      tone: 'text-emerald-700',
      fill: 'bg-emerald-500',
    }
  if (score >= 75)
    return { label: 'Strong', tone: 'text-sky-700', fill: 'bg-sky-500' }
  if (score >= 55)
    return { label: 'Moderate', tone: 'text-amber-700', fill: 'bg-amber-500' }
  return { label: 'Low', tone: 'text-rose-700', fill: 'bg-rose-500' }
}

export const FitScore = ({ score }: { readonly score: number | null }) => {
  if (score === null) {
    return <span className="text-sm text-muted-foreground">Not assessed</span>
  }

  const { label, tone, fill } = describeFitScore(score)
  return (
    <div className="min-w-28">
      <meter
        className="sr-only"
        aria-label="Application fit"
        min={0}
        max={100}
        value={score}
      >
        {score} out of 100, {label} fit
      </meter>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn('font-mono text-sm font-semibold tabular-nums', tone)}
        >
          {score}
        </span>
        <span className="text-[0.6875rem] font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-0.5" aria-hidden>
        {fitScoreSteps.map((threshold) => (
          <span
            key={threshold}
            className={cn(
              'h-1 rounded-full',
              score >= threshold ? fill : 'bg-muted'
            )}
          />
        ))}
      </div>
    </div>
  )
}
