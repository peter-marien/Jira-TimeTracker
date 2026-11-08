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

- [x] Upgrade TypeScript to approved compatible version (proposed 6.0.3).
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
- [x] Ensure native rebuild steps work on Windows x64.
- [ ] Verify IPC, power events, window recovery, tray, OAuth, notifications, updater.

## 3. Renderer and styles — PLAN phase 3

- [x] Replace react-input-mask with approved React-compatible alternative.
- [x] Remove old input-mask type package; add new dependency with built-in types.
- [x] Add focused time-input interaction checks: partial/full input, caret edits,
  blur normalization, invalid input, clear/Active, disabled state, prop updates.
- [x] Upgrade React/React DOM and corresponding types together.
- [x] Resolve React 19 API/type incompatibilities without unrelated refactoring.
- [x] Upgrade Radix, Lucide, charts, router, state, date, and remaining packages.
- [x] Migrate to DayPicker v10; verify custom components and date-range behavior.
- [ ] Upgrade Tailwind/PostCSS and introduce dedicated PostCSS integration.
- [ ] Remove redundant autoprefixer; explicitly preserve theme and animations.
- [ ] Review changed utilities, CSS-variable syntax, borders/rings/shadows/radii.
- [ ] Compare light/dark main window, mini-player, away dialog, calendar, charts.
- [ ] Validate lint, tests, types, and builds after each coherent upgrade group.

## 4. Windows validation — PLAN phase 4

- [ ] Retain Windows-only CI/release setup and existing platform-specific code.
- [ ] Keep manual release publishing separate from validation.
- [ ] Verify clean install, lint, regression tests, types, builds, native SQLite,
  and Electron smoke test on Windows.
- [ ] Build Windows NSIS with publishing disabled.
- [ ] Preserve macOS DMG/Linux AppImage configuration; document runtime support
  as unverified and platform validation as outside this task's scope.
- [ ] Check Windows packaged startup/native SQLite using disposable
  profiles/databases; retain actual results or explicit pending status.
- [ ] Avoid publishing commands and prebuild hooks that kill existing Electron apps.

## 5. Acceptance and handoff — PLAN phase 5

- [ ] Check start/stop/resume, mini-player, away handling, tray/window recovery.
- [ ] Check Windows hibernate/resume and monitor-removal scenarios.
- [ ] Verify existing database readability using a disposable fixture/copy.
- [ ] Verify Jira payloads with mocks and updater error/retry paths.
- [ ] Re-run npm audit; compare findings and document residual issues/exceptions.
- [ ] Confirm manifests/lockfile are synchronized and installs remain reproducible.
- [ ] Update README with final runtime/setup/native rebuild/validation instructions.
- [ ] Record final versions, commands, Windows results, and manual-check status.
- [ ] Review final diff for unrelated changes and unintended generated artifacts.
- [ ] Present results and any pending Windows/manual work; retain the explicit
  unverified macOS/Linux status without claiming cross-platform validation.
