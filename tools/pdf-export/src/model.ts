export type PdfExportSessionOptions = {
  readonly appRoot?: string
  readonly chromeExecutablePath?: string
  readonly env?: NodeJS.ProcessEnv
  readonly output?: 'ignore' | 'inherit'
  readonly preferredPort?: number
  readonly rootDir?: string
  readonly skipBuild?: boolean
  readonly webBaseUrl?: URL
}

export type ProfilePdfExportItem = {
  readonly audienceId: string
  readonly locale: string
  readonly outputFileName?: string
  readonly token: string
}

export type ProfilePdfBatchExportRequest = PdfExportSessionOptions & {
  readonly items: readonly ProfilePdfExportItem[]
  readonly outputDir?: string
}

export type ProfilePdfExportRequest = PdfExportSessionOptions &
  ProfilePdfExportItem & {
    readonly outputDir?: string
  }

export type ProfilePdfExportResult = {
  readonly audienceId: string
  readonly locale: string
  readonly outputPath: string
  readonly previewPath: string
}

export type PublicPdfExportRequest = PdfExportSessionOptions & {
  readonly locales: readonly string[]
  readonly outputDir?: string
}

export type PublicPdfExportResult = {
  readonly locale: string
  readonly outputPath: string
  readonly previewPath: string
}
