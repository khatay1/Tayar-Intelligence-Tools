# Tomorrow production release

## Goal

Publish the already-merged Admin AI model manager to production with exactly one Vercel production deployment after the Hobby deployment quota has reset.

## Protection already prepared

The release-prep branch configures Vercel Git deployments so only `main` deploys automatically. Development branches are disabled to prevent preview deployments from consuming the daily deployment allowance.

## Tomorrow sequence

1. Confirm Vercel quota is available.
2. Merge `prep/tomorrow-release` into `main`.
3. Do not push extra commits while the production deployment is running.
4. Wait for the single Vercel production deployment on the merge commit.
5. Confirm the GitHub Release Gate passes.
6. Run:

```powershell
git switch main
git pull --ff-only origin main
.\scripts\verify-production.ps1
```

7. Open Tayar Admin -> AI Management and verify:
   - dark Model Manager is visible;
   - Add model manually is visible;
   - a custom `gemini-*` model can be added;
   - a managed model can be selected and saved as Default;
   - the old white native select is gone.

## Important

Do not create empty commits or manual redeploys unless the production deployment genuinely fails for a code reason. One merge to `main` should be enough.
