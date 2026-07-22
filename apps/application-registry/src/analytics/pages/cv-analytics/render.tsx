import type { CvAnalyticsResponse } from '@cv/application-registry-api-contract'
import {
  BarChart,
  chartCssVars,
  RingChart,
  TimelineChart,
} from '@cv/internal-charts'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type DateRange,
  DateRangePicker,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cv/internal-ui'
import { useAtom, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import {
  AlertCircle,
  ArrowUpRight,
  Eye,
  FileCheck2,
  MousePointerClick,
  RefreshCw,
  UsersRound,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router'

import { asyncResultErrorMessage } from '@/lib/async-result'
import { formatLabel } from '../../../lib/format'
import { HeaderActions } from '../../../shell/header-actions'
import {
  type CvAnalyticsDays,
  type CvAnalyticsRangeKey,
  cvAnalyticsAtom,
  cvAnalyticsCustomRangeKey,
  cvAnalyticsPresetRangeKey,
  refreshCvAnalytics,
} from '../../data'

const numberFormatter = new Intl.NumberFormat()
const percentFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
  style: 'percent',
})
const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

const formatAnalyticsDate = (value: string | null): string => {
  if (value === null) return '—'
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

const fromAnalyticsDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

const toAnalyticsDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatCustomRange = (range?: DateRange): string => {
  if (!range?.from) return ''
  const from = formatAnalyticsDate(toAnalyticsDate(range.from))
  if (!range.to) return from
  return `${from} – ${formatAnalyticsDate(toAnalyticsDate(range.to))}`
}

const rangeOptions = [
  { label: 'Today', value: '1' },
  { label: 'Last 3 days', value: '3' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Custom range', value: 'custom' },
] as const

type AnalyticsRangeMode = CvAnalyticsDays | 'custom'

const SummaryCard = ({
  description,
  icon: Icon,
  label,
  value,
}: {
  readonly description: string
  readonly icon: React.ComponentType<{ readonly className?: string }>
  readonly label: string
  readonly value: string
}) => (
  <Card>
    <CardContent className="flex items-start justify-between gap-4 pt-5">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
    </CardContent>
  </Card>
)

const AnalyticsSkeleton = () => (
  <div aria-label="Loading CV analytics" className="grid gap-5" role="status">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {['published', 'visits', 'views', 'reach'].map((key) => (
        <Skeleton className="h-32 rounded-lg" key={key} />
      ))}
    </div>
    <div className="grid gap-5 xl:grid-cols-3">
      <Skeleton className="h-96 rounded-lg xl:col-span-2" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
    <Skeleton className="h-80 rounded-lg" />
  </div>
)

const AnalyticsContent = ({ data }: { readonly data: CvAnalyticsResponse }) => {
  const viewedRate =
    data.summary.publishedLinks === 0
      ? 0
      : data.summary.viewedLinks / data.summary.publishedLinks
  const applicationViews = new Map<
    string,
    { readonly id: string; readonly label: string; readonly value: number }
  >()
  for (const item of data.items) {
    const current = applicationViews.get(item.application.id)
    applicationViews.set(item.application.id, {
      id: item.application.id,
      label: `${item.application.company} · ${item.application.role}`,
      value: (current?.value ?? 0) + item.totals.pageViews,
    })
  }
  const topApplications = [...applicationViews.values()]
    .filter(({ value }) => value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 8)
  const topCountries = data.countries.slice(0, 8).map((country) => ({
    label: country.name,
    value: country.visits,
  }))

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          description={`${numberFormatter.format(data.summary.enabledLinks)} currently enabled`}
          icon={FileCheck2}
          label="Published CVs"
          value={numberFormatter.format(data.summary.publishedLinks)}
        />
        <SummaryCard
          description="Sessions across published CVs"
          icon={UsersRound}
          label="Visits"
          value={numberFormatter.format(data.summary.visits)}
        />
        <SummaryCard
          description="Total CV page loads"
          icon={Eye}
          label="Page views"
          value={numberFormatter.format(data.summary.pageViews)}
        />
        <SummaryCard
          description={`${numberFormatter.format(data.summary.viewedLinks)} of ${numberFormatter.format(data.summary.publishedLinks)} CVs viewed`}
          icon={MousePointerClick}
          label="CVs reached"
          value={percentFormatter.format(viewedRate)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <CardTitle>Traffic over time</CardTitle>
            <CardDescription>
              Visits and page views across every published CV.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimelineChart
              ariaLabel="CV traffic over time"
              data={data.series.map((point) => ({
                date: point.at,
                pageViews: point.pageViews,
                visits: point.visits,
              }))}
              emptyMessage="No CV traffic was recorded in this period."
              emptyWhenAllZero
              series={[
                {
                  area: true,
                  color: chartCssVars.series1,
                  dataKey: 'pageViews',
                  label: 'Page views',
                },
                {
                  color: chartCssVars.series2,
                  dataKey: 'visits',
                  label: 'Visits',
                },
              ]}
              xDataKey="date"
            />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Published CV reach</CardTitle>
            <CardDescription>
              CVs with at least one page view in this period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RingChart
              ariaLabel="Viewed and unviewed published CVs"
              centerLabel="Published CVs"
              data={[
                {
                  color: chartCssVars.series3,
                  label: 'Viewed',
                  value: data.summary.viewedLinks,
                },
                {
                  color: chartCssVars.series4,
                  label: 'Not viewed',
                  value: data.summary.unviewedLinks,
                },
              ]}
              emptyMessage="No CVs have been published yet."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Most-viewed applications</CardTitle>
            <CardDescription>
              Published CVs ranked by page views.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              ariaLabel="Most-viewed applications"
              data={topApplications}
              emptyMessage="No application CV has received a page view in this period."
              showLegend={false}
            />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Visitor countries</CardTitle>
            <CardDescription>
              Top countries by visits reported by Cloudflare.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              ariaLabel="Visits by country"
              data={topCountries}
              emptyMessage="No country data was reported in this period."
              showLegend={false}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Published CVs by application</CardTitle>
          <CardDescription>
            Application context and traffic for every current CV link, including
            links with no views.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto border-t border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Locale</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.link.id}>
                    <TableCell>
                      <div className="min-w-56">
                        <Link
                          className="font-medium hover:underline"
                          to={`/applications/${item.application.id}`}
                        >
                          {item.application.company}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.application.role}
                        </p>
                        {item.labels.length === 0 ? null : (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.labels.slice(0, 3).map((label) => (
                              <Badge key={label} variant="secondary">
                                {label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant="outline">
                          {formatLabel(item.application.applicationStatus)}
                        </Badge>
                        {!item.link.enabled ? (
                          <span className="text-xs text-muted-foreground">
                            CV disabled
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{item.link.locale}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {numberFormatter.format(item.totals.visits)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {numberFormatter.format(item.totals.pageViews)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatAnalyticsDate(item.firstSeenOn)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatAnalyticsDate(item.lastSeenOn)}
                    </TableCell>
                    <TableCell>
                      <Link
                        aria-label={`Open ${item.application.company} application`}
                        className={buttonVariants({
                          size: 'icon-sm',
                          variant: 'ghost',
                        })}
                        to={`/applications/${item.application.id}`}
                      >
                        <ArrowUpRight />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const CvAnalyticsPage = () => {
  const [rangeMode, setRangeMode] = React.useState<AnalyticsRangeMode>(7)
  const [customRange, setCustomRange] = React.useState<DateRange>()
  const [rangeKey, setRangeKey] = React.useState<CvAnalyticsRangeKey>(() =>
    cvAnalyticsPresetRangeKey(7)
  )
  const analyticsResult = useAtomValue(cvAnalyticsAtom(rangeKey))
  const [, refresh] = useAtom(refreshCvAnalytics, { mode: 'promiseExit' })
  const data = AsyncResult.getOrElse(analyticsResult, () => undefined)
  const error = asyncResultErrorMessage(
    analyticsResult,
    'CV analytics could not be loaded.'
  )
  const loading = AsyncResult.isWaiting(analyticsResult)
  const availableRange =
    data === undefined
      ? undefined
      : {
          earliest: fromAnalyticsDate(data.availability.from),
          latest: fromAnalyticsDate(data.availability.to),
        }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <HeaderActions>
        <Select
          ariaLabel="Analytics time range"
          className="w-32 sm:w-40"
          disabled={data === undefined}
          options={rangeOptions}
          value={String(rangeMode)}
          onValueChange={(value) => {
            if (value === 'custom') {
              setRangeMode('custom')
              if (customRange?.from && customRange.to) {
                setRangeKey(
                  cvAnalyticsCustomRangeKey(
                    toAnalyticsDate(customRange.from),
                    toAnalyticsDate(customRange.to)
                  )
                )
              }
              return
            }
            if (value === '1' || value === '3' || value === '7') {
              const days = Number(value) as CvAnalyticsDays
              setRangeMode(days)
              setRangeKey(cvAnalyticsPresetRangeKey(days))
            }
          }}
        />
        {rangeMode === 'custom' && availableRange !== undefined ? (
          <DateRangePicker
            ariaLabel="Choose custom analytics range"
            className="w-9 overflow-hidden px-2 sm:w-56 sm:px-3"
            formatRange={formatCustomRange}
            maxValue={availableRange.latest}
            minValue={availableRange.earliest}
            numberOfMonths={1}
            onChange={(value) => {
              setCustomRange(value)
              if (!value?.from || !value.to) return
              setRangeKey(
                cvAnalyticsCustomRangeKey(
                  toAnalyticsDate(value.from),
                  toAnalyticsDate(value.to)
                )
              )
            }}
            placeholder="Choose dates"
            value={customRange}
          />
        ) : null}
        <Button
          aria-label="Refresh CV analytics"
          className="size-9 px-0 xl:w-auto xl:px-3"
          disabled={loading}
          onClick={() => void refresh()}
          variant="outline"
        >
          <RefreshCw className={loading ? 'animate-spin' : undefined} />
          <span className="hidden xl:inline">Refresh</span>
        </Button>
      </HeaderActions>

      <div className="mx-auto grid w-full max-w-[100rem] gap-5 p-4 lg:p-8">
        {error !== undefined ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Could not load CV analytics</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {data === undefined && error === undefined ? (
          <AnalyticsSkeleton />
        ) : data === undefined ? null : (
          <AnalyticsContent data={data} />
        )}
      </div>
    </main>
  )
}
