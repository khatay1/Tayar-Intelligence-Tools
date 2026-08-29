param(
  [string]$Scope = 'tayar-tools',
  [string]$Project = 'tayar-intelligence-tools'
)

$ErrorActionPreference = 'Stop'
$Vercel = 'vercel@latest'

function Invoke-Vercel {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & npx --yes $Vercel @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Vercel command failed: $($Arguments -join ' ')"
  }
}

Write-Host ""
Write-Host "Tayar prebuilt production deploy" -ForegroundColor Cyan
Write-Host "Scope:   $Scope"
Write-Host "Project: $Project"
Write-Host ""

Write-Host "Checking Vercel login..." -ForegroundColor Cyan
& npx --yes $Vercel whoami *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Vercel login is required. A browser login will open now." -ForegroundColor Yellow
  Invoke-Vercel login
}

Write-Host ""
Write-Host "Linking the existing Vercel project..." -ForegroundColor Cyan
Invoke-Vercel link --yes --project $Project --scope $Scope

Write-Host ""
Write-Host "Pulling production environment/config..." -ForegroundColor Cyan
Invoke-Vercel pull --yes --environment=production --scope $Scope

Write-Host ""
Write-Host "Building locally for production..." -ForegroundColor Cyan
Invoke-Vercel build --prod --scope $Scope

Write-Host ""
Write-Host "Deploying prebuilt output to production..." -ForegroundColor Cyan
Invoke-Vercel deploy --prebuilt --prod --scope $Scope

Write-Host ""
Write-Host "Prebuilt production deployment completed." -ForegroundColor Green
