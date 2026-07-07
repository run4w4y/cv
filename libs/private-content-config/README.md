# @cv/private-content-config

Shared Effect config readers for content build and private content operator
environment variables.

Private build secrets are read from `PRIVATE_CONTENT_ROOT_KEY`. The root key is
consumed by TypeScript build tooling to derive profile content keys;
profile-specific keys are not environment inputs.
