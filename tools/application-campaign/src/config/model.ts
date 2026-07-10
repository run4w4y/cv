import { Schema } from 'effect'

export const defaultContentRoot = '../cv-content'
export const defaultCampaignOutRoot = '.cv-work/applications'
export const defaultPdfOutDir = '.cv-work/application-pdfs'
export const defaultLocale = 'en'
export const defaultCodexModel = 'gpt-5.5'
export const defaultExcludedProfiles = ['default'] as const
export const defaultCampaignConcurrency = 2

export const campaignMaterialsModes = ['all', 'none'] as const
export const CampaignMaterialsModeSchema = Schema.Literals(
  campaignMaterialsModes
)
export type CampaignMaterialsMode = Schema.Schema.Type<
  typeof CampaignMaterialsModeSchema
>

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

export const defaultCodexReasoningEffort: CodexReasoningEffort = 'medium'

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
  readonly excludedProfiles: readonly string[]
  readonly generate: boolean
  readonly locale: string
  readonly materials: CampaignMaterialsMode
  readonly outDir: string
  readonly pdfOutDir: string
  readonly profile?: string
  readonly skipBuild: boolean
  readonly skipPdf: boolean
  readonly targets: readonly PrepareCampaignTarget[]
  readonly webBaseUrl?: URL
}

export type PrepareCampaignOverrides = {
  readonly audience?: string
  readonly baseUrl?: URL
  readonly codexBin?: string
  readonly concurrency?: number
  readonly contentRoot?: string
  readonly excludedProfiles?: readonly string[]
  readonly generate?: boolean
  readonly locale?: string
  readonly materials?: CampaignMaterialsMode
  readonly model?: string
  readonly outDir?: string
  readonly outRoot?: string
  readonly pdfOutDir?: string
  readonly profile?: string
  readonly reasoningEffort?: CodexReasoningEffort
  readonly skipBuild?: boolean
  readonly skipPdf?: boolean
  readonly urlFileContents?: string
  readonly urls?: readonly URL[]
}
