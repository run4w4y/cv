import { Console, Effect, Option } from 'effect'
import { Path } from 'effect/Path'
import { Command, Flag as Options } from 'effect/unstable/cli'
import { buildDeclaration } from './declaration'
import { writeDeclarationFile } from './templates'

const authoringSourcePath = Options.string('authoring').pipe(
  Options.withDescription(
    'Authoring module to extract portable component declarations from.'
  )
)

const contentSourcePath = Options.string('source').pipe(
  Options.withDescription(
    'Content types source module to extract portable authoring declarations from.'
  )
)

const outputPath = Options.string('out').pipe(
  Options.withDescription(
    'Output declaration path. Generated declarations are written to stdout when omitted.'
  ),
  Options.optional
)

const writeOutput = (out: Option.Option<string>, source: string) =>
  Option.match(out, {
    onNone: () => Console.log(source),
    onSome: (rawPath) =>
      Path.pipe(
        Effect.flatMap((path) =>
          writeDeclarationFile(path.resolve(rawPath), source)
        ),
        Effect.andThen(Console.log(`Wrote ${rawPath}`))
      ),
  })

export const generateCommand = Command.make(
  'content-types',
  {
    authoring: authoringSourcePath,
    out: outputPath,
    source: contentSourcePath,
  },
  ({ authoring, out, source }) =>
    buildDeclaration({
      authoringSourcePath: authoring,
      contentSourcePath: source,
    }).pipe(Effect.flatMap((declaration) => writeOutput(out, declaration)))
)
