export interface HttpApiEndpointDeclaration {
  readonly identifier: string
  readonly method: string
  readonly path: string
}

/**
 * Keep the registry contract fail-fast when endpoint declarations are composed
 * dynamically, using the same logical identity exposed by HttpApi.
 */
export const assertUniqueHttpApiEndpoints = (
  groupIdentifier: string,
  endpoints: ReadonlyArray<HttpApiEndpointDeclaration>
): void => {
  const identifiers = new Set<string>()
  const operations = new Set<string>()

  for (const endpoint of endpoints) {
    if (identifiers.has(endpoint.identifier)) {
      throw new Error(
        `Duplicate HttpApiEndpoint identifier "${endpoint.identifier}" in HttpApiGroup "${groupIdentifier}".`
      )
    }
    identifiers.add(endpoint.identifier)

    const operation = `${endpoint.method} ${endpoint.path}`
    if (operations.has(operation)) {
      throw new Error(
        `Duplicate HttpApi operation "${operation}" in HttpApiGroup "${groupIdentifier}".`
      )
    }
    operations.add(operation)
  }
}
