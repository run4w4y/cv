import {
  localeSchema,
  profileSlugSchema,
  webBaseUrlSchema,
} from '@cv/content-core'
import { Effect, Option, References, Schema } from 'effect'
import { Command, Flag, GlobalFlag } from 'effect/unstable/cli'
import { makeCodexApplicationAdvisorLayer } from '../ai/advisor'
import {
  campaignMaterialsModes,
  codexReasoningEfforts,
  PositiveIntegerSchema,
} from '../config/model'
import { resolvePrepareCampaignOptions } from '../config/resolve'
import { parseCommaList } from '../config/targets'
import { CampaignReporter } from '../workflow/progress'
import { type PreparedCampaignRun, prepareCampaign } from '../workflow/run'
import {
  campaignOutputModes,
  makeCampaignPresenter,
  printCampaignResult,
} from './presenter'

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
  Flag.withSchema(webBaseUrlSchema),
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
const locale = Flag.string('locale').pipe(
  Flag.withSchema(localeSchema),
  Flag.withDescription(
    'Preferred locale for the selected profile and drafted copy.'
  ),
  Flag.optional
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
const output = Flag.choice('output', campaignOutputModes).pipe(
  Flag.withDefault('auto'),
  Flag.withDescription(
    'Terminal output mode. Auto uses the live display in an interactive terminal and plain output in CI or pipes.'
  )
)
const pdfOutDir = optionalString(
  'pdf-dir',
  'Directory where generated private profile PDFs are written.'
)
const profile = Flag.string('profile').pipe(
  Flag.withSchema(profileSlugSchema),
  Flag.withDescription(
    'Private CV profile slug to use instead of letting AI choose.'
  ),
  Flag.optional
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

export const campaignExitCode = (status: PreparedCampaignRun['status']) =>
  status === 'succeeded' ? 0 : 1

const setExitCodeFromResult = (result: PreparedCampaignRun) =>
  Effect.sync(() => {
    process.exitCode = campaignExitCode(result.status)
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
    output,
    pdfOutDir,
    profile,
    reasoningEffort,
    skipBuild,
    skipPdf,
    urlFile,
    urls,
  },
  (options) =>
    Effect.scoped(
      Effect.gen(function* () {
        const configuredLogLevel = yield* GlobalFlag.LogLevel
        const diagnosticLogs = Option.match(configuredLogLevel, {
          onNone: () => false,
          onSome: (level) => level !== 'None',
        })
        const { advisor, campaign } = yield* resolvePrepareCampaignOptions({
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
        })
        const presenter = yield* makeCampaignPresenter({
          diagnosticLogs,
          outputMode: options.output,
        })
        const campaignEffect = prepareCampaign(campaign).pipe(
          Effect.provide(makeCodexApplicationAdvisorLayer(advisor)),
          Effect.provideService(CampaignReporter, presenter.reporter)
        )
        const result = yield* Option.isNone(configuredLogLevel)
          ? campaignEffect.pipe(
              Effect.provideService(References.MinimumLogLevel, 'None')
            )
          : campaignEffect

        yield* printCampaignResult(result, presenter.mode)
        yield* setExitCodeFromResult(result)
      })
    )
)
