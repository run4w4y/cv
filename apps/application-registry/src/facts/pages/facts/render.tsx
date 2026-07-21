import type { CvGenerationGuidanceV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import type {
  LoadedActiveFactsRelease,
  LoadedFactsCatalogue,
} from '@cv/facts-reader/reader'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Select,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@cv/internal-ui'
import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import {
  AlertCircle,
  Archive,
  BookOpenCheck,
  Boxes,
  Database,
  FileCheck2,
  FileSearch,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router'

import { asyncResultErrorMessage } from '@/lib/async-result'
import { HeaderActions } from '@/shell/header-actions'
import { FactsCatalogueBrowser } from '../../components/catalogue-browser'
import { activeFactsReleaseAtom, factsCatalogueAtom } from '../../data'
import {
  factsCatalogueCounts,
  filterFactsSections,
  shortCommit,
  shortReleaseId,
} from '../../model/catalogue'

const numberFormatter = new Intl.NumberFormat()

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
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="mt-1 text-xs/5 text-muted-foreground">{description}</p>
      </div>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
    </CardContent>
  </Card>
)

const ReleaseOverview = ({
  loaded,
}: {
  readonly loaded: LoadedFactsCatalogue
}) => {
  const counts = factsCatalogueCounts(loaded.catalogue)
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Active verified release
              </CardTitle>
              <CardDescription className="mt-1 font-mono">
                <span className="sm:hidden">
                  {shortReleaseId(loaded.releaseId)}
                </span>
                <span className="hidden break-all sm:inline">
                  {loaded.releaseId}
                </span>
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="success">verified</Badge>
              <Badge variant="outline">{loaded.catalogue.locale}</Badge>
              <Badge variant="outline">{loaded.manifest.factsContract}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 border-t border-border pt-5 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Reviewed source
            </p>
            <p className="mt-1 break-all">
              {loaded.manifest.provenance.source.repository}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {shortCommit(loaded.manifest.provenance.source.commit)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Compiler
            </p>
            <p className="mt-1 break-all">
              {loaded.manifest.provenance.compiler.repository}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {shortCommit(loaded.manifest.provenance.compiler.commit)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          description={`${counts.sections} semantic catalogue sections`}
          icon={BookOpenCheck}
          label="Reviewed facts"
          value={numberFormatter.format(counts.facts)}
        />
        <SummaryCard
          description="Audit references linked from reviewed facts"
          icon={FileCheck2}
          label="Evidence records"
          value={numberFormatter.format(counts.evidence)}
        />
        <SummaryCard
          description={`${loaded.manifest.assets.length} immutable release objects`}
          icon={Boxes}
          label="Assets"
          value={numberFormatter.format(counts.assets)}
        />
        <SummaryCard
          description={loaded.locales.join(', ')}
          icon={Database}
          label="Locales"
          value={numberFormatter.format(loaded.locales.length)}
        />
      </div>
    </div>
  )
}

const EvidencePanel = ({
  catalogue,
}: {
  readonly catalogue: FactsCatalogueV1
}) =>
  catalogue.evidence.length === 0 ? (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <FileSearch />
        </EmptyMedia>
        <EmptyTitle>No evidence records</EmptyTitle>
        <EmptyDescription>
          This locale does not publish separate audit references.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ) : (
    <div className="grid gap-3 md:grid-cols-2">
      {catalogue.evidence.map((evidence) => (
        <Card className="[content-visibility:auto]" key={evidence.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{evidence.title}</CardTitle>
                <CardDescription className="mt-1 font-mono">
                  {evidence.id}
                </CardDescription>
              </div>
              <Badge variant="outline">{evidence.kind}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {evidence.note === undefined ? null : (
              <p className="text-sm/6 text-muted-foreground">{evidence.note}</p>
            )}
            {evidence.uri === undefined ? null : (
              <a
                className="break-all text-sm text-primary underline-offset-4 hover:underline"
                href={evidence.uri}
                rel="noreferrer"
                target="_blank"
              >
                {evidence.uri}
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )

const AssetsPanel = ({
  catalogue,
}: {
  readonly catalogue: FactsCatalogueV1
}) =>
  catalogue.assets.length === 0 ? (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <Archive />
        </EmptyMedia>
        <EmptyTitle>No asset metadata</EmptyTitle>
        <EmptyDescription>
          This locale does not reference reviewed binary assets.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ) : (
    <div className="grid gap-3 md:grid-cols-2">
      {catalogue.assets.map((asset) => (
        <Card className="[content-visibility:auto]" key={asset.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{asset.label}</CardTitle>
                <CardDescription className="mt-1 font-mono">
                  {asset.id}
                </CardDescription>
              </div>
              <Badge variant="outline">{asset.mediaType}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm/6 text-muted-foreground">
              {asset.description}
            </p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              sha256:{asset.sha256}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )

const GuidancePanel = ({
  guidance,
}: {
  readonly guidance: CvGenerationGuidanceV1
}) => (
  <div className="grid gap-5">
    <Card>
      <CardHeader>
        <CardTitle>{guidance.label}</CardTitle>
        <CardDescription>{guidance.$schema}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm/6">{guidance.instruction}</p>
        <div className="flex flex-wrap gap-1.5">
          {guidance.sources.map((source) => (
            <Badge key={source} variant="secondary">
              {source}
            </Badge>
          ))}
        </div>
        <ul className="grid gap-2 text-sm/6 text-muted-foreground">
          {guidance.rules.map((rule) => (
            <li key={rule}>• {rule}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
    <div className="grid gap-3 md:grid-cols-2">
      {guidance.fields.map((field) => (
        <Card className="[content-visibility:auto]" key={field.target}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle className="text-sm font-medium">
                {field.target}
              </CardTitle>
              {field.maxWords === undefined ? null : (
                <Badge variant="outline">≤ {field.maxWords} words</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm/6 text-muted-foreground">
              {field.instruction}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {field.sources.map((source) => (
                <Badge key={source} variant="secondary">
                  {source}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
)

const FactsContent = ({
  active,
  locale,
  search,
}: {
  readonly active: LoadedActiveFactsRelease
  readonly locale: string
  readonly search: string
}) => {
  const catalogueResult = useAtomValue(factsCatalogueAtom(active, locale))
  const loaded = AsyncResult.getOrElse(catalogueResult, () => undefined)
  const error = asyncResultErrorMessage(
    catalogueResult,
    `Facts for locale ${locale} could not be loaded.`
  )
  const deferredSearch = React.useDeferredValue(search)
  const sections =
    loaded === undefined
      ? []
      : filterFactsSections(loaded.catalogue.sections, deferredSearch)
  const staleRelease =
    loaded !== undefined && loaded.releaseId !== active.releaseId

  if (loaded === undefined && error === undefined) {
    return <FactsPageSkeleton />
  }

  if (loaded === undefined) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Could not load the facts catalogue</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-5">
      {error === undefined ? null : (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not refresh the facts catalogue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {staleRelease ? (
        <Alert>
          <RefreshCw />
          <AlertTitle>Updating to the latest release</AlertTitle>
          <AlertDescription>
            The previous verified catalogue remains visible while the new
            release is loaded.
          </AlertDescription>
        </Alert>
      ) : null}
      <ReleaseOverview loaded={loaded} />
      <Tabs defaultValue="catalogue">
        <div className="overflow-x-auto pb-1">
          <TabsList>
            <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
            <TabsTrigger value="evidence">
              Evidence · {loaded.catalogue.evidence.length}
            </TabsTrigger>
            <TabsTrigger value="assets">
              Assets · {loaded.catalogue.assets.length}
            </TabsTrigger>
            <TabsTrigger value="guidance">Generation guidance</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="catalogue" className="grid gap-4">
          <FactsCatalogueBrowser sections={sections} />
        </TabsContent>
        <TabsContent value="evidence">
          <EvidencePanel catalogue={loaded.catalogue} />
        </TabsContent>
        <TabsContent value="assets">
          <AssetsPanel catalogue={loaded.catalogue} />
        </TabsContent>
        <TabsContent value="guidance">
          <GuidancePanel guidance={loaded.generationGuidance} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

const FactsPageSkeleton = () => (
  <div
    aria-label="Loading facts catalogue"
    className="grid gap-5"
    role="status"
  >
    <Skeleton className="h-44 rounded-lg" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {['facts', 'evidence', 'assets', 'locales'].map((key) => (
        <Skeleton className="h-32 rounded-lg" key={key} />
      ))}
    </div>
    <Skeleton className="h-12 max-w-xl rounded-lg" />
    <Skeleton className="h-96 rounded-lg" />
  </div>
)

const setSearchParameter = (
  current: URLSearchParams,
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  key: string,
  value: string
) => {
  const next = new URLSearchParams(current)
  if (value.length === 0) next.delete(key)
  else next.set(key, value)
  setSearchParams(next, { replace: true })
}

export const FactsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeResult = useAtomValue(activeFactsReleaseAtom)
  const refresh = useAtomRefresh(activeFactsReleaseAtom)
  const active = AsyncResult.getOrElse(activeResult, () => undefined)
  const activeError = asyncResultErrorMessage(
    activeResult,
    'The active facts release could not be loaded.'
  )
  const requestedLocale = searchParams.get('locale')
  const search = searchParams.get('q') ?? ''
  const locale =
    active === undefined
      ? null
      : requestedLocale !== null && active.locales.includes(requestedLocale)
        ? requestedLocale
        : (active.locales[0] ?? null)
  const invalidLocale =
    active !== undefined &&
    requestedLocale !== null &&
    !active.locales.includes(requestedLocale)
  const refreshing = AsyncResult.isWaiting(activeResult)

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <HeaderActions>
        <Select
          ariaLabel="Facts locale"
          className="w-28 sm:w-36"
          disabled={active === undefined || locale === null}
          onValueChange={(value) => {
            if (value === null) return
            setSearchParameter(searchParams, setSearchParams, 'locale', value)
          }}
          options={(active?.locales ?? []).map((value) => ({
            label: value,
            value,
          }))}
          placeholder="Locale"
          value={locale}
        />
        <Button
          aria-label="Refresh facts"
          className="size-9 px-0 xl:w-auto xl:px-3"
          disabled={active === undefined || refreshing}
          onClick={refresh}
          variant="outline"
        >
          <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
          <span className="hidden xl:inline">Refresh</span>
        </Button>
      </HeaderActions>

      <div className="mx-auto grid w-full max-w-7xl gap-5 p-4 lg:p-8">
        <div>
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Private content catalogue
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Reviewed facts
          </h1>
          <p className="mt-2 max-w-3xl text-sm/6 text-muted-foreground">
            Inspect the active, integrity-verified facts release used by CV and
            cover-letter preparation workflows.
          </p>
        </div>

        <Alert>
          <LockKeyhole />
          <AlertTitle>Read-only by design</AlertTitle>
          <AlertDescription>
            Facts are reviewed and published outside this application. This page
            verifies and displays the active release but cannot modify or
            publish it.
          </AlertDescription>
        </Alert>

        {invalidLocale ? (
          <Alert>
            <AlertCircle />
            <AlertTitle>Requested locale is unavailable</AlertTitle>
            <AlertDescription>
              Locale {requestedLocale} is not in the active release. Showing{' '}
              {locale} instead.
            </AlertDescription>
          </Alert>
        ) : null}

        {activeError === undefined ? null : (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Could not load the active facts release</AlertTitle>
            <AlertDescription>{activeError}</AlertDescription>
          </Alert>
        )}

        {active === undefined && activeError === undefined ? (
          <FactsPageSkeleton />
        ) : active === undefined || locale === null ? null : (
          <div className="grid gap-4">
            <label className="relative max-w-xl" htmlFor="facts-search">
              <span className="sr-only">Search facts</span>
              <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                aria-label="Search facts"
                className="w-full pl-9"
                id="facts-search"
                name="facts-search"
                onChange={(event) =>
                  setSearchParameter(
                    searchParams,
                    setSearchParams,
                    'q',
                    event.currentTarget.value
                  )
                }
                placeholder="Search facts, IDs, companies, projects, technologies…"
                type="search"
                value={search}
              />
            </label>
            <FactsContent active={active} locale={locale} search={search} />
          </div>
        )}
      </div>
    </main>
  )
}
