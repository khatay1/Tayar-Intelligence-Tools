param(
  [string]$Scope = 'tayar-tools',
  [string]$Project = 'tayar-intelligence-tools'
)

$ErrorActionPreference = 'Stop'
$Vercel = 'vercel@latest'

function Invoke-Vercel {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  # Windows PowerShell 5 can turn harmless native stderr warnings (for example
  # npm deprecation notices) into NativeCommandError records. Run npx.cmd with
  # native errors in Continue mode and trust the process exit code instead.
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & npx.cmd --yes $Vercel @Arguments 2>&1 | ForEach-Object { Write-Host $_ }
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorAction
  }

  if ($exitCode -ne 0) {
    throw "Vercel command failed: $($Arguments -join ' ') (exit $exitCode)"
  }
}

function Test-VercelLogin {
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $loginOutput = & npx.cmd --yes $Vercel whoami 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorAction
  }

  if ($exitCode -eq 0) {
    $identity = ($loginOutput | Select-Object -Last 1)
    if ($identity) { Write-Host "Signed in to Vercel as $identity" -ForegroundColor Green }
    return $true
  }

  return $false
}

Write-Host ""
Write-Host "Tayar prebuilt production deploy" -ForegroundColor Cyan
Write-Host "Scope:   $Scope"
Write-Host "Project: $Project"
Write-Host ""

Write-Host "Checking Vercel login..." -ForegroundColor Cyan
if (-not (Test-VercelLogin)) {
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
