---
description: lint, bump version, and release the application to GitHub
---

1. Check if the current branch is master
```powershell
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "master") {
    Write-Error "Release must be performed on the 'master' branch. Current branch: $branch"
    exit 1
}
```

2. Check for uncommitted changes
```powershell
$status = git status --porcelain
if ($status) {
    Write-Error "Working tree is not clean. Please commit or stash changes before releasing."
    exit 1
}
```

3. Run lint and fix automatically
```powershell
npm run lint -- --fix
```

4. Verify no linting issues remain
```powershell
npm run lint
```

5. Bump the version and create commit/tag
```powershell
# Parameter: new-version (e.g. 0.8.4, patch, minor, major)
npm version {{new-version}}
```

6. Push changes and tags to Git
```powershell
git push origin master --tags
```

7. Trigger the release build and upload
```powershell
npm run release
```
