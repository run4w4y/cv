import { Console, Effect, Option, Schema } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { makeCodexApplicationAdvisorLayer } from '../ai/advisor'
import {
  campaignMaterialsModes,
  codexReasoningEfforts,
  PositiveIntegerSchema,
} from '../config/model'
import { resolvePrepareCampaignOptions } from '../config/resolve'
import { parseCommaList } from '../config/targets'
import type { CampaignIssue } from '../workflow/routine'
import { type PreparedCampaignRun, prepareCampaign } from '../workflow/run'

const NonEmptyTrimmedString = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty())
)

const optionalString = (name: string, description: string) =>
  Flag.string(name).pipe(
    Flag.withSchema(NonEmptyTrimmedString),
    Flag.withDescription(description),
    Flag.optional
  )

const urls = Flag.string('url').pipe(
  Flag.withSchema(Schema.URLFromString),
  Flag.atMost(10_000),
  Flag.withDescription(
    'Job posting URL to fetch and analyze. Can be passed multiple times.'
  )
)
const urlFile = Flag.fileText('url-file').pipe(
  Flag.withDescription(
    'File containing job posting URLs separated by newlines or commas.'
  ),
  Flag.optional
)
const audience = optionalString(
  'audience',
  'Private audience slug to use when generating a link.'
)
const baseUrl = Flag.string('base-url').pipe(
  Flag.withSchema(Schema.URLFromString),
  Flag.withDescription(
    'Deployed CV base URL. Overrides APPLICATION_CAMPAIGN_BASE_URL and CV_WEB_* env fallbacks.'
  ),
  Flag.optional
)
const codexBin = optionalString(
  'codex-bin',
  'Codex CLI path override passed to the Codex SDK.'
)
const contentRoot = optionalString(
  'content-root',
  'Content repository root. Overrides APPLICATION_CAMPAIGN_CONTENT_ROOT.'
)
const excludedProfiles = Flag.string('exclude-profiles').pipe(
  Flag.withDescription(
    'Comma-separated profile slugs to exclude from AI selection. Defaults to default.'
  ),
  Flag.optional
)
const locale = optionalString(
  'locale',
  'Preferred locale for the selected profile and drafted copy.'
)
const materials = Flag.choice('materials', campaignMaterialsModes).pipe(
  Flag.withDescription(
    'Applicant-facing material generation mode. Use none to skip cover letter and email drafts.'
  ),
  Flag.optional
)
const model = optionalString('model', 'Codex model override.')
const outDir = optionalString(
  'out',
  'Campaign artifact output directory. With multiple URLs this becomes the batch output root.'
)
const outRoot = optionalString(
  'out-root',
  'Directory where campaign artifact folders are created.'
)
const pdfOutDir = optionalString(
  'pdf-dir',
  'Directory where generated private profile PDFs are written.'
)
const profile = optionalString(
  'profile',
  'Private CV profile slug to use instead of letting AI choose.'
)
const reasoningEffort = Flag.choice(
  'reasoning-effort',
  codexReasoningEfforts
).pipe(
  Flag.withDescription(
    'Codex reasoning effort for profile selection and recommendation.'
  ),
  Flag.optional
)
const concurrency = Flag.integer('concurrency').pipe(
  Flag.withSchema(PositiveIntegerSchema),
  Flag.withDescription('Number of job URLs to process concurrently.'),
  Flag.optional
)
const generate = Flag.boolean('generate').pipe(
  Flag.withDefault(true),
  Flag.withDescription(
    'Mint a private CV link and export the matching PDF. Enabled by default; pass --no-generate to disable.'
  )
)
const skipBuild = Flag.boolean('skip-build').pipe(
  Flag.withDescription('Reuse the existing CV build when exporting a PDF.')
)
const skipPdf = Flag.boolean('skip-pdf').pipe(
  Flag.withDescription('Mint the private link but skip PDF export.')
)

const option = Option.getOrUndefined

const printIssues = (issues: readonly CampaignIssue[]) =>
  Effect.forEach(
    issues,
    (issue) =>
      issue.severity === 'warning'
        ? Console.log(`Warning: ${issue.message}`)
        : Console.error(`Error: ${issue.message}`),
    { discard: true }
  )

const printSingleResult = (result: PreparedCampaignRun) =>
  Effect.gen(function* () {
    const campaign = result.campaigns[0]

    if (!campaign) {
      return
    }

    yield* Console.log(`Application campaign written to ${campaign.outDir}`)
    yield* Console.log(`Status: ${campaign.status}`)

    if (campaign.status === 'failed') {
      yield* Console.error(`Campaign failed: ${campaign.error}`)
      return
    }

    yield* Console.log(`Selected profile: ${campaign.decisions.profile}`)
    yield* Console.log(`Audience slug: ${campaign.decisions.audience}`)

    if (campaign.generated.link) {
      yield* Console.log(`Private link: ${campaign.generated.link.url}`)
    }

    if (campaign.generated.pdfPath) {
      yield* Console.log(`PDF written to ${campaign.generated.pdfPath}`)
    }
  })

const printBatchResult = (result: PreparedCampaignRun) =>
  Effect.gen(function* () {
    yield* Console.log(`Application campaign run written to ${result.outDir}`)
    yield* Console.log(`Run status: ${result.status}`)

    yield* Effect.forEach(
      result.campaigns,
      (campaign) =>
        Console.log(
          campaign.status === 'failed'
            ? `- ${campaign.target.url.href} -> failed (${campaign.error})`
            : `- ${campaign.target.url.href} -> ${campaign.outDir} (${campaign.decisions.profile}, ${campaign.status})`
        ),
      { discard: true }
    )
  })

const printResult = (result: PreparedCampaignRun) =>
  Effect.gen(function* () {
    yield* result.campaigns.length === 1
      ? printSingleResult(result)
      : printBatchResult(result)
    yield* printIssues(result.issues)
  })

const setExitCodeFromResult = (result: PreparedCampaignRun) =>
  result.status === 'succeeded'
    ? Effect.void
    : Effect.sync(() => {
        process.exitCode = 1
      })

export const prepareCommand = Command.make(
  'application-campaign',
  {
    audience,
    baseUrl,
    codexBin,
    concurrency,
    contentRoot,
    excludedProfiles,
    generate,
    locale,
    materials,
    model,
    outDir,
    outRoot,
    pdfOutDir,
    profile,
    reasoningEffort,
    skipBuild,
    skipPdf,
    urlFile,
    urls,
  },
  (options) =>
    resolvePrepareCampaignOptions({
      audience: option(options.audience),
      baseUrl: option(options.baseUrl),
      codexBin: option(options.codexBin),
      concurrency: option(options.concurrency),
      contentRoot: option(options.contentRoot),
      excludedProfiles: Option.match(options.excludedProfiles, {
        onNone: () => undefined,
        onSome: parseCommaList,
      }),
      generate: options.generate,
      locale: option(options.locale),
      materials: option(options.materials),
      model: option(options.model),
      outDir: option(options.outDir),
      outRoot: option(options.outRoot),
      pdfOutDir: option(options.pdfOutDir),
      profile: option(options.profile),
      reasoningEffort: option(options.reasoningEffort),
      skipBuild: options.skipBuild,
      skipPdf: options.skipPdf,
      urlFileContents: option(options.urlFile),
      urls: options.urls,
    }).pipe(
      Effect.flatMap(({ advisor, campaign }) =>
        prepareCampaign(campaign).pipe(
          Effect.provide(makeCodexApplicationAdvisorLayer(advisor))
        )
      ),
      Effect.tap(printResult),
      Effect.tap(setExitCodeFromResult)
    )
)
