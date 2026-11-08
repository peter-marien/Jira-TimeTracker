# Dependency and Node.js upgrade tasks

Plan: [PLAN.md](PLAN.md). Branch: `codex/plan-dependency-node-upgrade`.

**Approved on 2026-11-08. Run tests before every commit. Use only disposable
database fixtures and isolated profiles; never open the user's live database.**

## 0. Investigation and approval

- [x] Create a new branch from clean `master` at `3b93217`.
- [x] Inspect manifests, lockfile, runtime pin, build/lint/style configuration,
  Electron boundaries, tests, and CI/release workflows.
- [x] Check official Node releases and every direct dependency's stable version.
- [x] Identify React input-mask, TypeScript/parser, Tailwind, and native ABI risks.
- [x] Record baseline: lint and type checks pass; 49 tests pass.
- [x] Record audit baseline: 40 vulnerable entries, including transitive/dev entries.
- [x] Confirm scope with user: latest stable including majors; preserve current
  platform setup, with Windows x64 validation and existing macOS/Linux declarations.
- [x] Write PLAN.md and matching TODO.md.
- [x] Obtain feedback on TypeScript exception and input-mask replacement.
- [x] Obtain explicit approval of both documents before implementation.

## 1. Runtime and reproducibility — PLAN phase 1

- [x] Recheck proposed versions and peer constraints; record significant changes.
- [x] Use Node 26.13.0/npm 11.20.0 without changing the global runtime default.
- [x] Update `.nvmrc`, Node engines, and README consistently.
- [x] Preserve both workflows' use of `.nvmrc`.
- [x] Regenerate package-lock.json alongside approved dependency changes.
- [x] Verify `npm ci` without forced or legacy peer resolution.

## 2. Tooling and desktop runtime — PLAN phase 2

- [x] Upgrade TypeScript to the approved compatible version, 6.0.3.
- [x] Verify test helper's compiler API and Node TypeScript/module-hook behavior.
- [x] Migrate deprecated TypeScript configuration while preserving `@/` aliases.
- [x] Upgrade ESLint/parser/plugins together and migrate to flat configuration.
- [x] Preserve lint scope, generated-output ignores, existing rules, zero warnings.
- [x] Run lint, tests, and type checks after this group; resolve migration failures.
- [x] Upgrade Vite/React plugin/Electron plugins together.
- [x] Migrate applicable build configuration to Rolldown options.
- [x] Verify main/mini-player HTML builds and native dependency externalization.
- [x] Verify main/preload output formats and production `.mjs` preload paths.
- [x] Check development startup and renderer integration.
- [x] Review Electron breaking changes and OS requirements; report material changes
  and request feedback if existing platform configuration would need to change.
- [x] Upgrade Electron, builder, SQLite/types, updater, and logging coherently.
- [x] Add/run isolated actual `better-sqlite3` checks for host Node and Electron.
- [x] Verify supplied Node-API binaries work on Windows x64 without a C++ rebuild.
- [x] Verify real IPC/tracking and simulated resume; existing mocked power/window
  recovery/tray/updater regressions pass.
- [ ] Manually verify installed tray interaction, OAuth callback registration,
  and OS notifications using a disposable profile/test account.

## 3. Renderer and styles — PLAN phase 3

- [x] Replace react-input-mask with approved React-compatible alternative.
- [x] Remove old input-mask type package; add new dependency with built-in types.
- [x] Add focused time-input interaction checks: partial/full input, caret edits,
  blur normalization, invalid input, clear/Active, disabled state, prop updates.
- [x] Upgrade React/React DOM and corresponding types together.
- [x] Resolve React 19 API/type incompatibilities without unrelated refactoring.
- [x] Upgrade Radix, Lucide, charts, router, state, date, and remaining packages.
- [x] Migrate to DayPicker v10; verify custom components and date-range behavior.
- [x] Upgrade Tailwind/PostCSS and introduce dedicated PostCSS integration.
- [x] Remove redundant autoprefixer; explicitly preserve theme and animations.
- [x] Review changed utilities, CSS-variable syntax, borders/rings/shadows/radii.
- [x] Compare light/dark main window, mini-player, away dialog, calendar, charts.
- [x] Validate lint, tests, types, and builds after each coherent upgrade group.

## 4. Windows validation — PLAN phase 4

- [x] Retain Windows-only CI/release setup and existing platform-specific code.
- [x] Keep manual release publishing separate from validation.
- [x] Verify clean install, lint, regression tests, types, builds, native SQLite,
  and Electron smoke test on Windows.
- [x] Build Windows NSIS with publishing disabled.
- [x] Preserve macOS DMG/Linux AppImage configuration; document runtime support
  as unverified and platform validation as outside this task's scope.
- [x] Check Windows packaged startup/native SQLite using disposable
  profiles/databases; retain actual results or explicit pending status.
- [x] Avoid publishing commands and prebuild hooks that kill existing Electron apps.

## 5. Acceptance and handoff — PLAN phase 5

- [x] Check built start/stop/simulated resume, mini-player synchronization, away
  dialog rendering, and existing tray/window recovery regression tests.
- [ ] Check Windows hibernate/resume and monitor-removal scenarios.
- [x] Verify database readability using a synthetic fixture created with the old
  SQLite package/Node 24 and reopened by the new package/Node 26; schema/rows match.
- [x] Verify Jira payloads with mocks and updater error/retry paths.
- [x] Re-run npm audit; compare findings and document residual issues/exceptions.
- [x] Confirm manifests/lockfile are synchronized and installs remain reproducible.
- [x] Update README with final runtime/setup/native binary/validation instructions.
- [x] Record final versions, commands, Windows results, and manual-check status.
- [x] Review final diff for unrelated changes and unintended generated artifacts.
- [x] Present results and any pending Windows/manual work; retain the explicit
  unverified macOS/Linux status without claiming cross-platform validation.
- [ ] Manually check installer UI and signed distribution/update delivery; the
  unsigned installer was built and its packaged code tested, not installed.
