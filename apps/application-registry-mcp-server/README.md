# Application registry MCP server

Local stdio MCP server for discovering, creating, and updating application
listings through the registry machine API. It is implemented with
`effect/unstable/ai/McpServer` and deliberately does not expose notes,
activities, listing checks, content, publications, or analytics.

## Tools

- `search_applications` searches listings and returns IDs, current versions,
  and an optional continuation cursor.
- `get_application` reads one listing and its current version.
- `create_application` creates a listing and rejects a duplicate normalized
  posting URL.
- `update_application` updates mutable listing fields. It requires
  `expectedVersion`, creates a UUIDv7 idempotency key for the API request, and
  returns that operation ID.

Read a listing immediately before updating it. A version conflict is intentional
protection against overwriting a concurrent change and should be resolved by
reading the listing again rather than retrying blindly.

## Configuration

The process requires two machine-client environment variables:

- `REGISTRY_API_URL`: registry origin. The client adds the machine transport
  prefix.
- `REGISTRY_API_TOKEN`: bearer token for the registry machine API.

The server sends mutations directly to the registry and reports transport
failures to the caller immediately.

Build the server and configure an MCP client to run the bundle over stdio:

```sh
bun run nx build application-registry-mcp-server
bun apps/application-registry-mcp-server/dist/main.js
```

All Effect logs are routed to stderr so stdout remains reserved for MCP JSON-RPC
messages.
