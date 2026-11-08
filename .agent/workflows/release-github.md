---
description: trigger and monitor the GitHub Actions release workflow
---

Use [the Release workflow](../../.github/workflows/release.yml) as the release
procedure. Follow the execution steps in the
[README deployment section](../../README.md#deploy-new-version-to-github).

1. Obtain the requested version: `patch`, `minor`, `major`, or an explicit `x.y.z`.
2. Ensure the intended release changes are committed and pushed to `master`,
   and that CI passes. Resolve lint failures during development.
3. Trigger the `Release` GitHub Actions workflow on `master`, passing the version
   as the `new-version` input.
4. Monitor the run and report its outcome and release link, or the failed step.

The release workflow calls the reusable CI workflow before bumping the version,
creating tags, or publishing. Validation reports failures without fixing lint
or committing source changes. Do not duplicate release operations locally.
