# AGENTS.md — Coding Guidelines for AI Assistants

## 1. Strict AI Operational Guardrails (Read First)

- **The 2-Strike Rule:** If a test, build step, command, or script fails more than TWICE with the exact same error, STOP EDITING IMMEDIATELY. Explain the error and explicitly ask for guidance. Do not attempt a third fix.
- **Zero Hallucination Policy:** Do not hallucinate functions, variables, missing files, or imports. If context is missing, STOP and ask. Never assume the structure of unread files.
- **Verify Before Writing:** Before modifying any file, you MUST use tools (e.g., `read` or `grep`) to confirm the target lines and logic actually exist. Do not blindly patch based on outdated context.
- **Output Restrictions:** No sycophantic openers or closing fluff. No em dashes, smart quotes, or Unicode. ASCII only. Be concise. If unsure, say so. Never guess.
- **Git Restrictions:** Never push to a remote, force-push, or use `--no-verify` unless explicitly commanded. Always confirm before destructive operations (e.g., `reset --hard`, `branch -D`).

## 2. Scope & Workflow Execution

- **Pre-Flight:** Read all relevant files and `CONTRIBUTING.md` before writing anything. Understand the full requirement.
- **Scope Control:** Only make changes directly requested. Do not refactor, add features, reformat, or add comments/types to code outside the scope of the prompt.
- **Testing Mandate:** Test after writing. Never leave code untested. Fix errors before moving on. Never declare a task "done" without a passing test.
- **Resilient Architect Principle:** Ensure state integrity if a failure occurs mid-execution. Document the failure point, fallback, and logging strategy for stateful/I/O-bound logic.

## 3. Architecture & Domain Specifics

- **Process Boundaries:** Electron desktop app with three boundaries: `src/main/` (Node.js, SQLite, BLE, MQTT), `src/preload/` (Context bridge), and `src/renderer/` (React 19, Vite, Zustand).
- **Dual-Protocol:** Support both `meshtastic` and `meshcore` protocols. Gate UI features via `ProtocolCapabilities`. Use `useRadioProvider(protocol)` rather than string comparisons.
- **Diagnostics Integration:** When modifying networking/routing logic, ensure compatibility with the Diagnostics panel and routing anomaly detection mechanisms (e.g., Hop Goblins, Hidden Terminals).
- **Package Management:** Strictly use `pnpm` for all operations to maintain our established launch speed benchmarks.
- **Technology Bans:** Do not introduce, suggest, or integrate any cryptocurrency-based technologies, dependencies, or services under any circumstances.

## 4. Code Style & Standards

- **Formatting:** Prettier strictly enforced. Semi: always, Quotes: single, Trailing commas: all, Print width: 100, Tab width: 2 spaces, End of line: LF.
- **TypeScript:** Strict mode enabled. Avoid `any`; use `unknown` with type guards. Export types explicitly and prefer interfaces over type aliases.
- **React:** Functional components only. `react-hooks/exhaustive-deps` is an error-level rule. Use optional chaining (`?.`) for nullable values in JSX. Every interactive element requires an `aria-label`.
- **State (Zustand):** Define default values outside components at the module level for stable reference equality. Avoid subscribing to entire Maps if only a single ID is needed.
- **Magic Numbers:** Extract time constants to `src/renderer/lib/timeConstants.ts` (e.g., `MS_PER_SECOND`). Define domain-specific thresholds at the module level.
- **Performance:** Avoid O(n) operations in hot paths. Extract lazy cleanup logic into private methods triggered only when a collection exceeds a threshold.

## 5. Security & Error Handling

- **Error Handling:** Never swallow errors. Every catch must log, rethrow, or have `// catch-no-log-ok <reason>`. Prefer Result Types over deep try/catch nesting.
- **Logging:** Use `console.debug` for diagnostics, `warn` for recoverable, `error` before rethrow. No bare `console.log`.
- **Log Injection Validation:** Sanitize user-controlled data with `sanitizeLogMessage()` at the call site before passing to `appendLine()` or any logger.
- **IPC Safety:** Never expose `ipcRenderer` directly. Use namespaced channels (e.g., `db:*`). Expose minimal API surface via `contextBridge`.
- **System Boundaries:** Banned `exec`/`execSync` (use spawn APIs). No `dangerouslySetInnerHTML` or `eval()`. Validate inputs at system boundaries but do not over-validate internal code.

## 6. Testing Protocols

- **Environments:** Renderer tests use jsdom (`src/renderer/**/*.test.{ts,tsx}`). Main tests use node (`src/main/**/*.test.ts`).
- **Console Mocking:** When testing code that logs errors, mock the console method before spying to prevent stderr noise (e.g., `vi.spyOn(console, 'warn').mockImplementation(() => {});`). Use `beforeEach` for shared setup.
- **Contract Tests:** Update `src/main/index.contract.test.ts` when changing CSP, build config, IPC limits, or log filters.

## 7. Commands & CI Checks

- **Development:** `pnpm run dev` (dev mode), `pnpm run build` (production build), `pnpm start` (build & start).
- **Quality:** `pnpm run lint` (ESLint), `pnpm run format` (Prettier), `pnpm run typecheck`, `pnpm run lint:md`.
- **Validation:** `pnpm run check:log-injection`, `pnpm run check:db-migrations`, `pnpm run check:ipc-contract`, `pnpm run check:licenses`.
- **Testing:** `pnpm test` (watch), `pnpm run test:run` (CI mode). Example single file: `npx vitest run src/main/database.test.ts`.

## 8. Git & PR Workflow

- **Commits:** Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- **Remote Tracking:** Ensure operations are tracked against the correct remote (`Colorado-Mesh/meshtastic-client`).
- **Pre-PR Sweep:** Update `README.md`, bump versions if warranted, and group metadata changes into a single commit before opening a PR.
- **PR Descriptions:** When executing `gh pr create`, the description MUST include details for all commits in the branch (`git log origin/main..HEAD --oneline`), not just the most recent one.
