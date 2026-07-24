# Application registry MCP server

Local stdio MCP server for discovering, creating, and updating application
listings through the registry API. It is implemented with
`effect/unstable/ai/McpServer`. Its task-oriented correspondence tool composes
the existing note and application-update API operations; it does not add or
require a separate API contract.

## Tools

- `search_applications` searches listings and returns IDs, current versions,
  and an optional continuation cursor.
- `get_application` reads one listing and its current version.
- `list_application_activities` reads the immutable activity history for one
  listing.
- `list_application_annotations` reads the labels and notes for one listing.
- `create_application` creates a listing and rejects a duplicate normalized
  posting URL.
- `update_application` updates mutable listing fields. It requires
  `expectedVersion`, creates a UUIDv7 idempotency key for the API request, and
  returns that operation ID.
- `record_application_correspondence` idempotently records a Gmail message as a
  contact note and, for a lifecycle classification, updates the application
  status with optimistic concurrency. Callers supply one stable operation ID;
  the tool derives separate note and update idempotency keys. If a concurrent
  change occurs after the note is stored, it returns `requiresReview` rather
  than hiding the partial result.

Read a listing immediately before updating it or recording correspondence. A
version conflict is intentional protection against overwriting a concurrent
change and should be resolved by reading the listing again rather than retrying
blindly.

## Configuration

The process requires two client environment variables:

- `REGISTRY_API_URL`: registry origin.
- `REGISTRY_API_TOKEN`: bearer token for the registry API.

The server sends mutations directly to the registry and reports transport
failures to the caller immediately.

Build the server and configure an MCP client to run the bundle over stdio:

```sh
bun run nx build application-registry-mcp-server
bun apps/application-registry-mcp-server/dist/main.js
```

All Effect logs are routed to stderr so stdout remains reserved for MCP JSON-RPC
messages.
