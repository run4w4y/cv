import type {
  DesktopBridgeErrorCode,
  DesktopCodexGenerationRequest,
  DesktopCodexGenerationResult,
  DesktopTokenUsage,
} from '@cv/application-registry-desktop-contract'
import {
  Codex,
  type CodexOptions,
  type ThreadOptions,
  type TurnOptions,
  type Usage,
} from '@openai/codex-sdk'
import { Match, Predicate, Schema } from 'effect'

type CodexTurn = {
  readonly finalResponse: string
  readonly usage: Usage | null
}

type CodexThread = {
  readonly run: (input: string, options?: TurnOptions) => Promise<CodexTurn>
}

type CodexClient = {
  readonly startThread: (options?: ThreadOptions) => CodexThread
}

export type CodexFactory = (options?: CodexOptions) => CodexClient

type CodexSdkOptions = {
  readonly codexFactory?: CodexFactory
  readonly cwd?: string
  readonly environment?: NodeJS.ProcessEnv
  readonly executable?: string
}

const maxDiagnosticCharacters = 8_000

const CodexSdkErrorCodeSchema = Schema.Literals([
  'codex_cancelled',
  'codex_generation_failed',
  'codex_model_unavailable',
  'codex_not_authenticated',
  'codex_not_available',
  'codex_output_invalid',
  'codex_rate_limited',
  'codex_state_initialization_failed',
  'invalid_request',
])
type CodexSdkErrorCode = Extract<
  DesktopBridgeErrorCode,
  typeof CodexSdkErrorCodeSchema.Type
>

export class CodexSdkError extends Schema.TaggedErrorClass<CodexSdkError>()(
  'CodexSdkError',
  {
    code: CodexSdkErrorCodeSchema,
    details: Schema.NullOr(Schema.String),
    message: Schema.String,
  }
) {
  constructor(
    code: CodexSdkErrorCode,
    message: string,
    details: string | null = null
  ) {
    super({ code, details, message })
  }
}

export const resolveCodexExecutable = ({
  environment = process.env,
}: {
  readonly environment?: NodeJS.ProcessEnv
} = {}): string | undefined => {
  const configured = environment.CV_CODEX_EXECUTABLE?.trim()
  return configured || undefined
}

const allowedEnvironmentKeys = new Set([
  'ALL_PROXY',
  'APPDATA',
  'COLORTERM',
  'ComSpec',
  'HOME',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'LANG',
  'LC_ALL',
  'LOCALAPPDATA',
  'NO_PROXY',
  'Path',
  'PATH',
  'PATHEXT',
  'ProgramData',
  'ProgramFiles',
  'ProgramFiles(x86)',
  'SystemDrive',
  'SystemRoot',
  'TEMP',
  'TERM',
  'TMP',
  'USERPROFILE',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_STATE_HOME',
  'http_proxy',
  'https_proxy',
  'no_proxy',
])

export const codexEnvironment = (
  environment: NodeJS.ProcessEnv
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(environment).flatMap(([key, value]) =>
      allowedEnvironmentKeys.has(key) && value !== undefined
        ? [[key, value]]
        : []
    )
  )

const jsonOutput = (text: string): unknown => {
  const trimmed = text.trim()
  const unfenced = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')
    : trimmed
  try {
    return JSON.parse(unfenced) as unknown
  } catch (error) {
    throw new CodexSdkError(
      'codex_output_invalid',
      'Codex completed without valid JSON output.',
      diagnostic(error)
    )
  }
}

const diagnostic = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(Predicate.isError, (error) =>
      [error.message, error.stack]
        .filter(
          (part, index, parts): part is string =>
            typeof part === 'string' &&
            part.length > 0 &&
            parts.indexOf(part) === index
        )
        .join('\n')
        .slice(-maxDiagnosticCharacters)
    ),
    Match.orElse((error) => String(error).slice(-maxDiagnosticCharacters))
  )

export const normalizeCodexSdkError = (
  error: unknown,
  aborted = false
): CodexSdkError => {
  if (Schema.is(CodexSdkError)(error)) return error
  const details = diagnostic(error)

  if (
    aborted ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    /abort(?:ed)?|operation was cancelled/iu.test(details)
  ) {
    return new CodexSdkError(
      'codex_cancelled',
      'The Codex generation was cancelled.',
      details
    )
  }
  if (/rate limit|usage limit|too many requests|\b429\b/iu.test(details)) {
    return new CodexSdkError(
      'codex_rate_limited',
      'The local Codex account has reached a usage limit.',
      details
    )
  }
  if (
    /not logged in|not signed in|login required|authentication|unauthori[sz]ed|\b401\b/iu.test(
      details
    )
  ) {
    return new CodexSdkError(
      'codex_not_authenticated',
      'The native Codex installation is not signed in. Sign in with Codex, then run the workflow again.',
      details
    )
  }
  if (/model.+(?:not found|unavailable|unsupported)/iu.test(details)) {
    return new CodexSdkError(
      'codex_model_unavailable',
      'The model configured in the native Codex installation is unavailable.',
      details
    )
  }
  if (
    /ENOENT|not found|cannot find the file|is not recognized/iu.test(details)
  ) {
    return new CodexSdkError(
      'codex_not_available',
      'The native Codex executable could not be found. Install or update Codex, then run the workflow again.',
      details
    )
  }
  if (/sqlite|database|migration|checksum/iu.test(details)) {
    return new CodexSdkError(
      'codex_state_initialization_failed',
      'The native Codex installation could not initialize its local state.',
      details
    )
  }
  return new CodexSdkError(
    'codex_generation_failed',
    'The local Codex generation failed.',
    details
  )
}

const generationPrompt = (request: DesktopCodexGenerationRequest): string =>
  [
    request.instructions,
    'Return only the JSON value requested by the supplied output schema.',
    'Do not invoke tools, commands, web search, or external resources.',
    request.prompt,
  ]
    .filter(
      (part): part is string => typeof part === 'string' && part.length > 0
    )
    .join('\n\n')

const tokenUsage = (usage: Usage | null): DesktopTokenUsage => ({
  inputTokens: usage?.input_tokens ?? null,
  outputTokens: usage?.output_tokens ?? null,
  totalTokens: usage === null ? null : usage.input_tokens + usage.output_tokens,
})

const defaultCodexFactory: CodexFactory = (options) => {
  const codex = new Codex(options)
  return {
    startThread: (threadOptions) => codex.startThread(threadOptions),
  }
}

export class CodexSdk {
  readonly #active = new Map<string, AbortController>()
  readonly #codex: CodexClient
  readonly #cwd: string | undefined
  readonly executable: string | undefined

  constructor(options: CodexSdkOptions) {
    this.#cwd = options.cwd
    const environment = options.environment ?? process.env
    const factory = options.codexFactory ?? defaultCodexFactory
    this.executable =
      options.executable ?? resolveCodexExecutable({ environment })
    this.#codex = factory({
      codexPathOverride: this.executable,
      env: codexEnvironment(environment),
    })
  }

  async generate(
    request: DesktopCodexGenerationRequest,
    workingDirectory = this.#cwd
  ): Promise<DesktopCodexGenerationResult> {
    if (this.#active.has(request.operationId)) {
      throw new CodexSdkError(
        'invalid_request',
        'The Codex operation ID is already active.'
      )
    }

    const controller = new AbortController()
    this.#active.set(request.operationId, controller)
    try {
      const thread = this.#codex.startThread({
        approvalPolicy: 'never',
        networkAccessEnabled: false,
        sandboxMode: 'read-only',
        skipGitRepoCheck: true,
        webSearchMode: 'disabled',
        workingDirectory,
      })
      const turn = await thread.run(generationPrompt(request), {
        outputSchema: request.outputSchema,
        signal: controller.signal,
      })
      return {
        output: jsonOutput(turn.finalResponse),
        usage: tokenUsage(turn.usage),
      }
    } catch (error) {
      throw normalizeCodexSdkError(error, controller.signal.aborted)
    } finally {
      this.#active.delete(request.operationId)
    }
  }

  cancel(operationId: string): void {
    this.#active.get(operationId)?.abort()
  }
}
