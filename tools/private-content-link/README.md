# @cv/private-content-link

Operator tool for minting private audience links for encrypted static content.

The package also exports `PrivateContentLink`, `PrivateContentLinkLive`, and
`mintPrivateContentLink` for programmatic minting without filesystem services.
Persistence is a separate `writePrivateContentLink` operation so callers that
only need the URL do not acquire `FileSystem` or `Path` dependencies.

The tool does not inspect authored content or the CV app schema. It reads the
private content secrets from the environment, derives the selected profile
content key, encodes the audience label, and prints a URL shaped like:

```text
/<locale>/a/<audience-id>/?p=<profile-token>
```

## Usage

```bash
bunx nx run private-content-link:link -- \
  --profile frontend \
  --audience acme \
  --locale en \
  --base-url https://cv.example.com
```

Required flags:

- `--profile <slug>`: authored content profile slug.
- `--audience <label>` or `--aud <label>`: human-readable audience label.
- `--locale <locale>`: locale used in the generated URL.

Optional flags:

- `--base-url <url>`: deployed site base URL. If omitted, the tool prints a
  site-relative path.
- `--out <path>`: write the URL to a file in addition to printing it.

Required environment:

- `CONTENT_ID_SALT`
- `PRIVATE_CONTENT_AUDIENCE_KEY`
- `PRIVATE_CONTENT_ROOT_KEY`

The output includes the URL, source audience label, compact audience id,
authored profile slug, and generated opaque profile id. Minting another audience
URL for an existing profile does not require rebuilding the static app, but
changing encrypted content or rotating `PRIVATE_CONTENT_ROOT_KEY` does.
