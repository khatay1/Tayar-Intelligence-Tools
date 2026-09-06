param(
  [ValidateNotNullOrEmpty()]
  [string]$ProjectRef = 'pnbllxdlskljcakyaylt',

  [switch]$Apply,

  [switch]$ConfirmProduction,

  [switch]$ConfirmAuthConfig
)

$ErrorActionPreference = 'Stop'
$CliVersion = '2.116.0'
$Migration = 'supabase/migrations/20260829144000_harden_admin_role_and_admin_access.sql'
$LaunchMigration = 'supabase/migrations/20260906100643_launch_auth_and_billing_hardening.sql'
$Functions = @(
  'ai-engine',
  'billing-admin-control',
  'billing-admin-status',
  'billing-portal',
  'create-checkout-session',
  'delete-account',
  'email-service',
  'public-plan-catalog',
  'stripe-webhook'
)

function Invoke-Supabase {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  & npx --yes "supabase@$CliVersion" @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase command failed: $($Arguments -join ' ')"
  }
}

if (-not (Test-Path $Migration)) {
  throw "Required admin hardening migration is missing: $Migration"
}
if (-not (Test-Path $LaunchMigration)) {
  throw "Required launch hardening migration is missing: $LaunchMigration"
}

# Supabase CLI parses the repository .env file before commands run. Some Windows
# editors save UTF-8 with a BOM, which Supabase treats as part of the first
# variable name. Strip only that BOM and preserve the rest of the file exactly.
$EnvPath = Join-Path (Get-Location) '.env'
if (Test-Path $EnvPath) {
  $bytes = [System.IO.File]::ReadAllBytes($EnvPath)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "Removing UTF-8 BOM from .env for Supabase CLI compatibility..." -ForegroundColor Yellow
    [System.IO.File]::WriteAllBytes($EnvPath, $bytes[3..($bytes.Length - 1)])
  }
}

Write-Host ""
Write-Host "Tayar Admin Hardening - Supabase deployment guard" -ForegroundColor Cyan
Write-Host "Project ref: $ProjectRef"
Write-Host "CLI: supabase@$CliVersion"
Write-Host ""

Invoke-Supabase --version
Invoke-Supabase link --project-ref $ProjectRef

Write-Host ""
Write-Host "Remote migration status:" -ForegroundColor Cyan
Invoke-Supabase migration list

Write-Host ""
Write-Host "Database dry-run (no changes):" -ForegroundColor Cyan
Invoke-Supabase db push --dry-run

Write-Host ""
Write-Host "Edge Functions affected by the shared suspension check:" -ForegroundColor Cyan
$Functions | ForEach-Object { Write-Host "  - $_" }

if (-not $Apply) {
  Write-Host ""
  Write-Host "DRY RUN COMPLETE. Nothing was deployed." -ForegroundColor Green
  Write-Host "Review the output above before applying production changes."
  Write-Host ""
  Write-Host "To apply after review:"
  Write-Host ".\scripts\admin-hardening-deploy.ps1 -ProjectRef $ProjectRef -Apply -ConfirmProduction -ConfirmAuthConfig"
  exit 0
}

if (-not $ConfirmProduction) {
  throw "Refusing to deploy. -Apply requires -ConfirmProduction."
}
if (-not $ConfirmAuthConfig) {
  throw "Refusing to push Auth settings. Review supabase/config.toml and the production Site URL/redirect allowlist, then pass -ConfirmAuthConfig."
}

Write-Host ""
Write-Host "Applying pending database migrations..." -ForegroundColor Yellow
Invoke-Supabase db push

Write-Host ""
Write-Host "Applying Auth hook and password configuration..." -ForegroundColor Yellow
Invoke-Supabase config push

Write-Host ""
Write-Host "Deploying Edge Functions that consume supabase/functions/_shared/billing.ts..." -ForegroundColor Yellow
foreach ($FunctionName in $Functions) {
  if ($FunctionName -in @('public-plan-catalog', 'stripe-webhook')) {
    Invoke-Supabase functions deploy $FunctionName --project-ref $ProjectRef --no-verify-jwt
  } else {
    Invoke-Supabase functions deploy $FunctionName --project-ref $ProjectRef
  }
}

Write-Host ""
Write-Host "Admin hardening deployment completed." -ForegroundColor Green
Write-Host "Next: sign in as an admin and run the admin verification checklist."
