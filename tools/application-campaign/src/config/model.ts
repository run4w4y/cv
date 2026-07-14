import type { Locale, ProfileSlug, WebBaseUrl } from '@cv/content-core'
import { Schema } from 'effect'

export const defaultContentRoot = '../cv-content'
export const defaultCampaignOutRoot = '.cv-work/applications'
export const defaultPdfOutDir = '.cv-work/application-pdfs'
export const defaultLocale = 'en'
export const defaultCodexAnalysisModel = 'gpt-5.6-terra'
export const defaultCodexRecommendationModel = 'gpt-5.6-sol'
export const defaultCampaignConcurrency = 2

export const campaignMaterialsModes = ['all', 'none'] as const
export const CampaignMaterialsModeSchema = Schema.Literals(
  campaignMaterialsModes
)
export type CampaignMaterialsMode = Schema.Schema.Type<
  typeof CampaignMaterialsModeSchema
>

export const registryConflictStrategies = [
  'prompt',
  'abort',
  'merge',
  'replace',
  'keep-both',
  'skip',
] as const
export type RegistryConflictStrategy =
  (typeof registryConflictStrategies)[number]

export const codexReasoningEfforts = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const
export const CodexReasoningEffortSchema = Schema.Literals(codexReasoningEfforts)
export type CodexReasoningEffort = Schema.Schema.Type<
  typeof CodexReasoningEffortSchema
>

export const defaultCodexAnalysisReasoningEffort: CodexReasoningEffort = 'low'
export const defaultCodexRecommendationReasoningEffort: CodexReasoningEffort =
  'low'

export const PositiveIntegerSchema = Schema.Int.check(Schema.isGreaterThan(0))

export type PrepareCampaignTarget = {
  readonly index: number
  readonly outDir: string
  readonly url: URL
}

export type PrepareCampaignOptions = {
  readonly audience?: string
  readonly concurrency: number
  readonly contentRoot: string
  /** Undefined applies the content repository's configured default profile. */
  readonly excludedProfiles?: readonly string[]
  readonly generate: boolean
  readonly locale: Locale
  readonly materials: CampaignMaterialsMode
  readonly outDir: string
  readonly pdfOutDir: string
  readonly profile?: ProfileSlug
  readonly registryConflictStrategy?: RegistryConflictStrategy
  readonly skipBuild: boolean
  readonly skipPdf: boolean
  readonly targets: readonly PrepareCampaignTarget[]
  readonly webBaseUrl?: WebBaseUrl
}

export type PrepareCampaignOverrides = {
  readonly analysisModel?: string
  readonly analysisReasoningEffort?: CodexReasoningEffort
  readonly audience?: string
  readonly baseUrl?: WebBaseUrl
  readonly codexBin?: string
  readonly concurrency?: number
  readonly contentRoot?: string
  readonly excludedProfiles?: readonly string[]
  readonly generate?: boolean
  readonly locale?: Locale
  readonly materials?: CampaignMaterialsMode
  readonly model?: string
  readonly outDir?: string
  readonly outRoot?: string
  readonly pdfOutDir?: string
  readonly profile?: ProfileSlug
  readonly recommendationModel?: string
  readonly recommendationReasoningEffort?: CodexReasoningEffort
  readonly registryConflictStrategy?: RegistryConflictStrategy
  readonly reasoningEffort?: CodexReasoningEffort
  readonly skipBuild?: boolean
  readonly skipPdf?: boolean
  readonly urlFileContents?: string
  readonly urls?: readonly URL[]
}
