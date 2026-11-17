# Dependency and Node.js upgrade plan

Status: **Implemented on Windows x64; physical OS/integration checks remain manual.**

Investigated on 2026-11-08 from commit `3b93217`.
Branch: `codex/plan-dependency-node-upgrade`.
Execution checklist: [TODO.md](TODO.md).

## Objective and agreed scope

Update Node.js and direct dependencies to current stable releases, including major
upgrades, while preserving time tracking, Jira synchronization, existing data,
application appearance, and desktop behavior. Following the user's scope revision,
preserve the current platform setup: validate Windows x64 and retain the existing
macOS DMG and Linux AppImage configuration. Linux/macOS runtime compatibility
remains unverified; adding platform support, CI runners, or distribution guarantees
is outside this upgrade.

The planning stage changed only `PLAN.md` and `TODO.md`. The user approved
implementation on 2026-11-08 and requested tests before every commit and protection
of the current database. Release publishing remains outside the authorized work.

## Investigation and baseline

- Electron desktop app with React renderer, TypeScript, Vite, Tailwind CSS,
  Radix/shadcn components, Zustand, and SQLite through `better-sqlite3`.
- Two renderer entry points: the main application and the mini-player. Electron
  also opens an away dialog. Main and preload bundles are built through
  `vite-plugin-electron/simple`.
- `.nvmrc` specifies Node 24; the local runtime is 24.22.1 with npm 11.19.1.
  `package.json` has no Node engine declaration. Node used by build tools is
  separate from the Node runtime bundled inside Electron.
- Both GitHub workflows read `.nvmrc`. CI and releases currently use Windows
  runners. Packaging configuration also declares macOS DMG and Linux AppImage.
- ESLint uses `.eslintrc.cjs`; Tailwind uses v3 directives and a JavaScript theme.
  `tsconfig.json` uses `baseUrl` with the `@/` alias.
- Regression tests use Node's test runner, TypeScript stripping, module hooks,
  and in-memory `node:sqlite`. The Electron test checks the built preload/context
  bridge, but does not exercise the production `better-sqlite3` binding.
- Baseline on the unchanged installation: `npm run lint` passes, `npm test`
  passes all 49 tests, and `npx --no-install tsc --noEmit` passes.
- Baseline `npm audit` reports 40 vulnerable dependency entries: 2 low, 8 moderate,
  29 high, and 1 critical. These counts include development/transitive packages
  and do not establish application exploitability. Reassess after upgrading.
- No clean install, application rebuild, packaging, or full GUI baseline was run
  during planning. These checks remain implementation tasks.

## Proposed versions

Versions below were checked against the npm registry and the official Node
release index on the investigation date. Recheck before implementation and record
any materially different targets for review. Current values are lockfile versions,
not the lower bounds in `package.json`.

| Component | Current | Proposed target | Notes |
| --- | --- | --- | --- |
| Node.js | `.nvmrc`: 24 | 26.13.0 LTS | Latest stable and LTS; exclude prereleases |
| npm | Local 11.19.1 | 11.20.0 | Bundled with the proposed Node release |
| Electron | 30.5.1 | 45.2.3 | Review intervening breaking changes and OS support |
| electron-builder | 24.13.3 | 26.18.0 | Validate Windows native rebuild and packaging |
| better-sqlite3 | 12.5.0 | 13.0.3 | Verify both host Node and Electron bindings |
| @types/better-sqlite3 | 7.6.13 | 9.6.0 | Check declarations against actual API usage |
| React / React DOM | 18.3.1 | 19.3.1 | Upgrade together |
| @types/react / @types/react-dom | 18.3.27 / 18.3.7 | 19.3.0 / 19.3.0 | Upgrade with React |
| Vite | 5.4.21 | 8.3.6 | Rolldown migration |
| @vitejs/plugin-react | 4.7.0 | 6.2.1 | Upgrade with Vite |
| vite-plugin-electron | 0.28.8 | 1.2.0 | Verify main/preload output formats and filenames |
| vite-plugin-electron-renderer | 0.14.6 | 1.0.0 | Validate renderer integration |
| TypeScript | 5.9.3 | 6.0.3, compatibility exception | Latest stable is 7.0.2; see below |
| @types/node | 25.0.3 | 26.6.6 | Check Electron code against its bundled runtime too |
| ESLint | 8.57.1 | 10.14.0 | Migrate to flat configuration |
| @typescript-eslint/parser and eslint-plugin | 8.52.0 | 8.72.1 | Keep both on the same version |
| eslint-plugin-react-hooks | 4.6.2 | 7.1.1 | Review new recommendations separately from existing rules |
| eslint-plugin-react-refresh | 0.4.26 | 0.5.7 | Retain existing component-export checks |
| Tailwind CSS | 3.4.17 | 4.3.5 | Preserve theme and utility semantics |
| PostCSS | 8.5.6 | 8.5.32 | Add @tailwindcss/postcss 4.3.5 |
| react-day-picker | 9.13.0 | @daypicker/react 10.0.2 | Prefer the documented v10 package name |
| lucide-react | 0.562.0 | 1.70.0 | Check icon exports and appearance |
| sharp | 0.34.5 | 0.35.5 | Validate image/icon generation |

Update the remaining direct packages to their checked stable versions:

| Packages | Targets |
| --- | --- |
| Radix alert-dialog / progress / separator / tabs / tooltip | 1.2.1 / 1.2.1 / 1.2.0 / 1.2.1 / 1.4.1 |
| Radix avatar / dialog / popover | 1.3.1 / 1.3.1 / 1.3.1 |
| Radix checkbox / switch / scroll-area | 1.4.1 / 1.4.1 / 1.4.0 |
| Radix context-menu / dropdown-menu / select | 2.4.1 / 2.2.1 / 2.4.1 |
| Radix label / radio-group / slot | 2.1.17 / 1.5.1 / 1.5.0 |
| axios / date-fns | 1.21.0 / 4.4.0 |
| electron-log / electron-updater | 5.4.4 / 6.8.11 |
| react-router-dom / recharts | 7.18.5 / 3.10.1 |
| sonner / tailwind-merge / zustand | 2.0.8 / 3.7.0 / 5.1.0 |
| dotenv-cli / png-to-ico | 11.1.0 / 3.0.2 |

The checked versions of `@dnd-kit/core` (6.3.1), modifiers (9.0.0), utilities
(3.2.2), `class-variance-authority` (0.7.1), `clsx` (2.1.1), `cmdk` (1.1.1),
`next-themes` (0.4.6), `node-machine-id` (1.1.12), `cross-env` (10.1.0), and
`tailwindcss-animate` (1.0.7) are already current. Keep them unless compatibility
testing demonstrates a need to change them.

## Compatibility decisions

1. **TypeScript exception:** use 6.0.3 initially. The latest ESLint parser declares
   TypeScript `>=4.8.4 <6.1.0`, which excludes 7.0.2. Do not bypass peer validation
   with `--force` or `--legacy-peer-deps`. Confirm `ts.transpileModule` still serves
   `tests/load-electron-module.mjs`. Remove deprecated `baseUrl` usage while
   preserving both Vite and Node-test aliases. Revisit TypeScript 7 when the
   parser and test compiler API support it.
2. **Input mask replacement:** the installed `react-input-mask` 2.0.4 calls
   `ReactDOM.findDOMNode`, removed in React 19. Replace it with `@react-input/mask`
   2.0.4 and remove `@types/react-input-mask`. Preserve `HH:mm:ss`, partial input,
   caret/edit behavior, validation on blur, disabled state, and empty/Active
   values. Add focused interaction coverage for this behavior change.
3. **Tailwind migration:** use the dedicated PostCSS plugin, remove redundant
   autoprefixer, and load or migrate the existing theme explicitly. Review
   preflight, shadows, borders, rings, radii, arbitrary CSS-variable utilities,
   animations, and dark mode. Avoid a visual redesign.
4. **Lint migration:** introduce `eslint.config.js`, with explicit TypeScript
   scope and generated-output exclusions. Preserve current checks and the
   zero-warning requirement. Resolve upgrade-related failures without broad rule
   suppression or silently enabling a larger compiler-rule cleanup.
5. **Platform scope confirmed:** retain Windows x64 validation and the existing
   macOS/Linux packaging declarations. Do not introduce additional architectures,
   a CI platform matrix, signing/notarization work, or macOS/Linux acceptance
   requirements. Review Electron's OS requirements and report material changes;
   ask for feedback if an upgrade would require changing the existing platform
   configuration. Preserve existing platform-specific code during migration.

## Implementation phases after approval

### 1. Reproducible runtime and installation

Use the approved Node runtime in an isolated tool environment; do not change the
machine-wide default. Pin `.nvmrc` to 26.13.0, declare the supported Node 26 range
in `package.json`, and update README instructions. Both workflows should continue
to use `.nvmrc`. Regenerate the lockfile using npm 11.20.0 and confirm `npm ci`
works without peer overrides. Keep the existing caret version convention except
where a compatibility ceiling is needed; the lockfile records exact resolutions.

### 2. Tooling and Electron/native dependencies

Upgrade ESLint/parser/plugins and TypeScript together; validate lint, types, and
the existing tests. Upgrade Vite and its plugins together; migrate applicable
`rollupOptions` to `rolldownOptions`. Verify both HTML entries, externalization
of `better-sqlite3`, preload `.mjs` output, and development startup.

Upgrade Electron, electron-builder, SQLite, logging, and updater packages as a
coherent group. Review Electron breaking changes across the skipped majors.
Check IPC, context isolation, tray/menu behavior, OAuth protocol registration,
window recovery, power events, notifications, and updater integration.

Exercise the actual SQLite native binding in both Node and Electron with a
temporary database. A passing in-memory `node:sqlite` test is insufficient.
Use explicit rebuild/install steps where needed so host tests and Electron
packaging each receive the correct native ABI; verify fresh installs on Windows
x64. Avoid accessing the user's saved database.

### 3. Renderer and styling

Replace the input mask and upgrade React, React DOM, and their types together.
Upgrade Radix, charts, icons, router, state, and date libraries. Migrate DayPicker
imports and verify range selection, navigation, locale/week start, and custom
calendar components. Upgrade Tailwind/PostCSS and fix semantic utility changes
while preserving the appearance of both renderer entry points.

Validate after each coherent group. Add tests for concrete behavior changes;
avoid rewriting unrelated application code or adding tests that only assert
dependency version strings. Keep manifests and the lockfile synchronized.

### 4. Windows verification and packaging

Keep CI and the manually invoked release workflow on Windows. Run lint, tests,
type checks, renderer/main/preload builds, and the Electron smoke test on Windows
x64. Retain the current workflow structure and make only changes required by
the approved runtime and dependency upgrades.

Build an unpublished Windows NSIS artifact with publishing disabled. Validate
native SQLite and packaged startup using an isolated profile. Preserve the
existing macOS DMG/Linux AppImage declarations, without building or validating
those platforms as part of this task. Document their existing unverified status.

Do not run the current `npm run release` command for validation: it publishes.
Avoid the current prebuild hook killing an existing Electron session; run the
individual build/package steps with publishing disabled during verification.

### 5. Acceptance and handoff

Acceptance requires a clean reproducible install; lint, all existing tests, focused
new interaction/native-binding checks, type checks, builds, and Electron smoke
checks passing on Windows x64. Compare audit results and document
remaining advisories and compatibility exceptions rather than force-upgrading.

Manually check main window, mini-player, away dialog, calendar/time inputs,
light/dark themes, charts, tracking start/stop/resume, tray recovery, and existing
database readability using a disposable fixture/copy. Exercise hibernation and
monitor removal on Windows. Check Jira payloads with mocks; any live Jira writes
need separate authorization. Test updater failure/retry behavior without publishing.

Update README and TODO with actual commands, results, deferred work, and version
exceptions. Any unrun required Windows/manual check stays explicitly pending.
Record macOS/Linux validation as outside the agreed scope, rather than pending
acceptance work. Do not claim verified cross-platform support.

## Approval and database protection

The user approved both documents, including the TypeScript exception and input-mask
replacement. Run the regression suite before every implementation commit.

Never launch the application against its default profile during validation.
Use temporary application profiles and disposable database fixtures for native,
schema, and packaged checks. Do not alter the database schema as part of this
dependency upgrade. Do not read, migrate, or write the user's live database.

## Implementation findings

- Node 26 and the desktop dependency upgrades form one runtime stage because
  better-sqlite3 12.5.0 does not declare support for Node 26.
- better-sqlite3 13.0.3 ships Node-API prebuilds. The Windows x64 binary passes
  fixture checks under both host Node and Electron without rebuilding. Disable
  electron-builder's unnecessary npm rebuild, which otherwise attempts a local
  C++ compilation; reconsider this setting if adding other native dependencies.
  npm 11.20.0 also inferred a SQLite rebuild during `npm ci` despite the package's
  `gypfile: false`; explicitly skip that package's scripts through `allowScripts`.
- Electron 45 raises the macOS minimum to 13; packaging declarations remain
  unchanged and macOS/Linux runtime validation remains out of scope.
- The initially proposed react-imask shifted seconds when replacing selected
  minutes. The real Chromium interaction test reproduced the issue, including
  with overwrite mode. Use @react-input/mask 2.0.4 with `separate: true` instead;
  this retains positions and integrates with the existing Input through a ref.
  Tests cover selected replacement/deletion, formatted insertion, prop changes,
  partial/invalid values, clearing/Active, and disabled input without any database.

## Validation results — 2026-11-08

All commands below used isolated Node 26.13.0/npm 11.20.0 on Windows x64.
The machine-wide default Node version was not changed.

| Check | Result |
| --- | --- |
| `npm ci` | Clean install succeeds without forced peer resolution |
| `npm ls --all` | Valid dependency tree, no reported problems |
| Manifest/lockfile comparison | Direct dependencies, dev dependencies, and engines match |
| `npm run lint` | Passes with zero warnings |
| `npx tsc --noEmit` | Passes with TypeScript 6.0.3 |
| `npm test` | All 49 regressions pass; run before every implementation commit |
| `npm run test:sqlite` | Real native SQLite passes row/schema preservation, integrity, foreign-key, WAL, and rollback checks |
| Historical fixture upgrade | SQLite package 12.5.0 on Node 24 creates a synthetic database; 13.0.3 on Node 26 preserves identical rows/schema, including an active entry |
| `npx vite build` | Main/mini-player renderers, Electron main, and `.mjs` preload build successfully |
| Development server probe | Both HTML entries and React transforms pass; automatic Electron startup disabled |
| `npm run test:electron` | Real context bridge/listener cleanup and Electron native SQLite fixture pass |
| `npm run test:input` | Native keyboard, selected replacement/deletion, formatted insertion, partial/invalid input, clear/Active, props, disabled input, calendar range, and Monday week-start checks pass |
| `npm run test:app` | Real built IPC/database tracking start/stop and simulated resume pass; mini-player updates to idle; away dialog and calendar navigation render using a disposable profile |
| Visual checks | Inspected dashboard, month view, reports/charts, settings, mini-player, and away dialog in light/dark themes, plus calendar |
| Image/icon libraries | SVG-to-PNG-to-ICO generation passes in memory |
| Windows packaging | Unpublished, unsigned NSIS installer produced in `out/upgrade-package` |
| Packaged checks | Packaged executable loads its own SQLite binary and preserves a disposable fixture; packaged main/preload/renderer bundle boots under an isolated profile |

No live database was opened or copied. The production database schema/migration
source (`src/database/db.ts`) is unchanged from the starting commit. Every test
that creates data uses a generated temporary directory; full app tests verify
that the database path belongs to that directory before exercising IPC writes.
OAuth protocol registration is stubbed and external renderer HTTP is blocked.
No installer was run, release published, application version bumped, or Git push
performed. The existing prebuild/prerelease process-killing hooks were not invoked.

All direct dependencies are at their checked stable targets except the approved
TypeScript 6.0.3 compatibility ceiling. The final audit reports **14 moderate
development-tool dependency entries**, down from 40 total entries including high
and critical findings. `npm audit --omit=dev` reports **zero** findings. The
remaining entries trace to minimatch's glob amplification advisory
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) through
current lint/build tools. npm's suggested fixes include downgrading those tools;
no forced downgrade or incompatible transitive major override was applied.

Build output retains non-failing warnings about large renderer chunks, an existing
mixed static/dynamic crypto import, and missing package author/description fields.
The test installer is unsigned because no signing certificate was configured.

### Manual checks still required

- Physical Windows hibernate/resume and monitor-disconnection scenarios.
- Installed-app tray interaction, OS notifications, and browser OAuth callback
  registration using a disposable profile/test account.
- Installer UI and signed distribution/update delivery. The installer was built
  and its packaged code checked, but it was not installed or published.

These are not claimed as passing. Existing regression tests cover simulated power,
window recovery, tray updates, updater retries, and mocked Jira payloads. Live
Jira writes were not performed. macOS/Linux configuration remains present with
runtime compatibility explicitly unverified, as agreed.

## Primary sources

- [Node.js release index](https://nodejs.org/dist/index.json): stable release,
  LTS status, and bundled npm version.
- [npm registry metadata](https://registry.npmjs.org/): stable versions and peer
  constraints; specifically [the parser metadata](https://registry.npmjs.org/@typescript-eslint/parser/latest)
  establishes the current TypeScript ceiling.
- [Vite migration guide](https://vite.dev/guide/migration): Vite 8/Rolldown changes.
- [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide):
  removed APIs and type migration.
- [React Input mask documentation](https://github.com/GoncharukOrg/react-input/tree/main/packages/mask):
  replacement input integration and fixed-position editing.
- [Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide): PostCSS,
  theme loading, utilities, and preflight changes.
- [ESLint 10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0):
  configuration and compatibility requirements.
- [DayPicker upgrade guide](https://daypicker.dev/upgrading): v10 package naming
  and migration guidance.
- [Electron native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
  and [breaking changes](https://www.electronjs.org/docs/latest/breaking-changes):
  native ABI and desktop compatibility review.
