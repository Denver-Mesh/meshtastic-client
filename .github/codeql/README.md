# CodeQL configuration

## Why there is no `codeql.yml` workflow

This repository uses **CodeQL default setup** (enabled under **Settings → Code security and analysis → Code scanning**). When default setup is on, GitHub **rejects SARIF uploads** from the CodeQL action to avoid duplicate/conflicting alerts. See:

- [Upload was rejected because CodeQL default setup is enabled](https://docs.github.com/en/code-security/code-scanning/troubleshooting-sarif-uploads/default-setup-enabled)

So the previous workflow that ran `github/codeql-action` with a custom `config-file` failed in CI with:

> CodeQL analyses from advanced configurations cannot be processed when the default setup is enabled

Default setup already runs JavaScript/TypeScript analysis on push/PR; no separate workflow is required for scanning to occur.

## `js/http-to-file-access` and the log file

Default CodeQL flags `appendFile` / `writeFileSync` in `src/main/log-service.ts` when HTTP-tainted data can reach those sinks. The query does not treat `sanitizeLogPayloadForDisk` as a barrier, so we document each sink with `// codeql[js/http-to-file-access]` after sanitizing (same idea as `// codeql[js/log-injection]` in `gps.ts`). **Pre-commit:** `src/main/log-service.contract.test.ts` asserts disk payloads stay wired through `sanitizeLogPayloadForDisk` and that those suppression tags remain on the sink lines.

## Using `codeql-config.yml` (advanced setup only)

`codeql-config.yml` is a named pack stub for repos that switch to **advanced** CodeQL with `config-file: ./.github/codeql/codeql-config.yml`. It does not disable `js/http-to-file-access`. If you add advanced setup:

1. In **Settings → Code security and analysis → Code scanning**, disable CodeQL default setup (or avoid duplicate uploads).
2. Use `github/codeql-action/init@v4` with `config-file: ./.github/codeql/codeql-config.yml` and `analyze` as documented.

Do not run both default setup and a CodeQL workflow that uploads SARIF for the same scope—GitHub will reject the upload.
