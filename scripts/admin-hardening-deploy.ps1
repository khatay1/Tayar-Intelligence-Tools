param(
  [ValidateNotNullOrEmpty()]
  [string]$ProjectRef = 'pnbllxdlskljcakyaylt',

  [switch]$Apply,

  [switch]$ConfirmProduction
)

$ErrorActionPreference = 'Stop'
$CliVersion = '2.116.0'
$Migration = 'supabase/migrations/20260829144000_harden_admin_role_and_admin_access.sql'
$Functions = @(
  'ai-engine',
  'billing-portal',
  'create-checkout-session',
  'email-service'
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
  Write-Host ".\scripts\admin-hardening-deploy.ps1 -ProjectRef $ProjectRef -Apply -ConfirmProduction"
  exit 0
}

if (-not $ConfirmProduction) {
  throw "Refusing to deploy. -Apply requires -ConfirmProduction."
}

Write-Host ""
Write-Host "Applying pending database migrations..." -ForegroundColor Yellow
Invoke-Supabase db push

Write-Host ""
Write-Host "Deploying Edge Functions that consume supabase/functions/_shared/billing.ts..." -ForegroundColor Yellow
foreach ($FunctionName in $Functions) {
  Invoke-Supabase functions deploy $FunctionName --project-ref $ProjectRef
}

Write-Host ""
Write-Host "Admin hardening deployment completed." -ForegroundColor Green
Write-Host "Next: sign in as an admin and run the admin verification checklist."
