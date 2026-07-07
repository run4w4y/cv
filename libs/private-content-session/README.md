# @cv/private-content-session

Runtime session helpers for private content experiences.

The package models public, loading, unlocked, invalid, and unavailable content
sessions. It reads access tokens, verifies private capability tokens, checks the
route-selected audience, opens encrypted profile payloads through
`@cv/private-content-protocol`, applies private content overlays, and returns
private file keys for unlocked sessions.

This package also owns browser/runtime file URL resolution for generated content
assets, including `/files/...` public hrefs and `/_content/files/...` encrypted
file hrefs.
