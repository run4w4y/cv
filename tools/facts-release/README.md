# Facts toolchain

`cv-facts` is the public, versioned compiler used by `run4w4y/cv-content`.
It loads the authored TypeScript checkout without a sibling repository, checks
the complete locale structure, and builds a deterministic
`cv.facts-bundle.v1` file containing the immutable release objects.

The production command verifies that bundle locally, negotiates the registry's
publication contracts, registers the immutable objects, and activates the
release with compare-and-set. It never receives MinIO credentials. The registry
API is the only writer to the facts bucket.

```sh
cv-facts check --content-root .
cv-facts build --content-root . --source-commit "$GITHUB_SHA" --output facts.bundle.json
FACTS_PUBLISH_TOKEN=... cv-facts publish \
  --bundle facts.bundle.json \
  --registry-url https://applications.example.com
```

Tags named `facts-toolchain-v<package-version>` run the release workflow. The
GitHub Release contains a deterministic Linux archive with the self-contained
binary, canonical `virtual:facts` declaration, contract metadata, checksum, and
GitHub build-provenance attestation. `cv-content` pins and verifies that public
artifact through `facts-toolchain.lock.json`.

The bundle and command output contain hashes and counts; commands do not print
catalogue text, asset bytes, or the publication token.
