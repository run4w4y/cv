import { Schema } from 'effect'

export class RegistryMigrationError extends Schema.TaggedErrorClass<RegistryMigrationError>()(
  'RegistryMigrationError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
    operation: Schema.String,
  }
) {}

export const migrationError =
  (operation: string, message: string) => (cause: unknown) =>
    new RegistryMigrationError({ cause, message, operation })

export const migrationFailure = (operation: string, message: string) =>
  new RegistryMigrationError({
    cause: new Error(message),
    message,
    operation,
  })
