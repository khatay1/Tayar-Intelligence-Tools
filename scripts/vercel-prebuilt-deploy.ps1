param(
  [string]$Scope = 'tayar-tools',
  [string]$Project = 'tayar-intelligence-tools'
)

$ErrorActionPreference = 'Stop'
$VercelPackage = 'vercel@latest'
$VercelInstallDir = Join-Path $env:TEMP 'tayar-vercel-cli'
$VercelCmd = Join-Path $VercelInstallDir 'node_modules\.bin\vercel.cmd'

# Vercel's Windows build runner spawns cmd.exe for package scripts. Some
# PowerShell environments do not expose System32 to child-process PATH, which
# causes "spawn cmd.exe ENOENT". Normalize the Windows command environment.
$CmdExe = Join-Path $env:SystemRoot 'System32\cmd.exe'
$System32 = Split-Path $CmdExe -Parent
if (-not (Test-Path $CmdExe)) {
  throw "Windows command processor was not found at $CmdExe"
}
$env:ComSpec = $CmdExe
$pathEntries = @($env:Path -split ';' | Where-Object { $_ })
if ($pathEntries -notcontains $System32) {
  $env:Path = "$System32;$env:Path"
}
if (-not $env:PATHEXT) {
  $env:PATHEXT = '.COM;.EXE;.BAT;.CMD'
}

# npm/Vercel may ignore ComSpec and spawn the configured script shell by name.
# Force npm lifecycle scripts to use the absolute Windows command processor.
$env:npm_config_script_shell = $CmdExe
$env:NPM_CONFIG_SCRIPT_SHELL = $CmdExe

function Ensure-VercelCli {
  if (Test-Path $VercelCmd) {
    return
  }

  Write-Host "Installing isolated Vercel CLI..." -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path $VercelInstallDir | Out-Null

  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & npm.cmd install --prefix $VercelInstallDir --no-save --package-lock=false --fund=false --audit=false $VercelPackage 2>&1 |
      ForEach-Object { Write-Host $_ }
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorAction
  }

  if ($exitCode -ne 0 -or -not (Test-Path $VercelCmd)) {
    throw "Failed to install isolated Vercel CLI (exit $exitCode)"
  }
}

function Invoke-Vercel {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  Ensure-VercelCli

  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $VercelCmd @Arguments 2>&1 | ForEach-Object { Write-Host $_ }
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
  Ensure-VercelCli

  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $loginOutput = & $VercelCmd whoami 2>&1
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
Write-Host "Building Vite directly (bypassing vercel build)..." -ForegroundColor Cyan

$ViteEntry = Join-Path (Get-Location) 'node_modules\vite\bin\vite.js'
if (-not (Test-Path $ViteEntry)) {
  throw "Local Vite installation not found at $ViteEntry. Run npm install in the project, then rerun this script."
}

# vercel pull can redact Sensitive Environment Variables as "[SENSITIVE]".
# Vite would otherwise bake those placeholders into the browser bundle. Merge
# the pulled production env with valid local browser values and fail closed
# before building if the required Supabase config cannot be resolved.
$PulledEnv = Join-Path (Get-Location) '.vercel\.env.production.local'
$RootEnv = Join-Path (Get-Location) '.env.production.local'
$RootEnvBackup = Join-Path $env:TEMP ('tayar-env-production-' + [guid]::NewGuid().ToString('N') + '.bak')
$HadRootEnv = Test-Path $RootEnv

function Get-DotEnvValue {
  param(
    [string]$Path,
    [string]$Name
  )

  if (-not (Test-Path $Path)) {
    return $null
  }

  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    if ($line -match ('^\s*' + [regex]::Escape($Name) + '\s*=\s*(.*)\s*$')) {
      $value = $Matches[1].Trim()
      if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      ) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      if ($value -and $value -ne '[SENSITIVE]') {
        return $value
      }
    }
  }

  return $null
}

function Resolve-LocalEnvValue {
  param([string]$Name)

  $processValue = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if ($processValue -and $processValue -ne '[SENSITIVE]') {
    return $processValue.Trim()
  }

  $candidates = @(
    (Join-Path (Get-Location) '.env.local'),
    (Join-Path (Get-Location) '.env.production'),
    (Join-Path (Get-Location) '.env')
  )
  if ($HadRootEnv -and (Test-Path $RootEnvBackup)) {
    $candidates = @($RootEnvBackup) + $candidates
  }

  foreach ($candidate in $candidates) {
    $value = Get-DotEnvValue -Path $candidate -Name $Name
    if ($value) {
      return $value
    }
  }

  return $null
}

if ($HadRootEnv) {
  Copy-Item $RootEnv $RootEnvBackup -Force
}

$SupabaseUrl = Resolve-LocalEnvValue 'VITE_SUPABASE_URL'
$SupabaseAnonKey = Resolve-LocalEnvValue 'VITE_SUPABASE_ANON_KEY'

if (-not $SupabaseUrl -and (Test-Path $PulledEnv)) {
  $SupabaseUrl = Get-DotEnvValue -Path $PulledEnv -Name 'VITE_SUPABASE_URL'
}
if (-not $SupabaseAnonKey -and (Test-Path $PulledEnv)) {
  $SupabaseAnonKey = Get-DotEnvValue -Path $PulledEnv -Name 'VITE_SUPABASE_ANON_KEY'
}

if (-not $SupabaseUrl -or $SupabaseUrl -notmatch '^https?://') {
  throw 'A valid VITE_SUPABASE_URL was not found locally. Restore it in .env.local or .env before deploying.'
}
if (-not $SupabaseAnonKey -or $SupabaseAnonKey -eq '[SENSITIVE]') {
  throw 'VITE_SUPABASE_ANON_KEY is redacted by Vercel and no valid local copy was found. Restore it in .env.local or .env before deploying.'
}

$pulledLines = @()
if (Test-Path $PulledEnv) {
  $pulledLines = @([System.IO.File]::ReadAllLines($PulledEnv) | Where-Object {
    $_ -notmatch '^\s*VITE_SUPABASE_URL\s*=' -and
    $_ -notmatch '^\s*VITE_SUPABASE_ANON_KEY\s*=' -and
    $_ -notmatch '\[SENSITIVE\]'
  })
}

$mergedLines = @($pulledLines) + @(
  ('VITE_SUPABASE_URL="' + $SupabaseUrl.Replace('"', '\"') + '"'),
  ('VITE_SUPABASE_ANON_KEY="' + $SupabaseAnonKey.Replace('"', '\"') + '"')
)
[System.IO.File]::WriteAllLines(
  $RootEnv,
  $mergedLines,
  (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "Validated local Supabase browser configuration." -ForegroundColor Green

try {
  if (Test-Path (Join-Path (Get-Location) 'dist')) {
    Remove-Item (Join-Path (Get-Location) 'dist') -Recurse -Force
  }

  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & node.exe $ViteEntry build 2>&1 | ForEach-Object { Write-Host $_ }
    $viteExit = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorAction
  }

  if ($viteExit -ne 0) {
    throw "Direct Vite production build failed (exit $viteExit)"
  }
}
finally {
  if ($HadRootEnv -and (Test-Path $RootEnvBackup)) {
    Copy-Item $RootEnvBackup $RootEnv -Force
    Remove-Item $RootEnvBackup -Force
  }
  elseif (Test-Path $RootEnv) {
    Remove-Item $RootEnv -Force
  }
}

$DistDir = Join-Path (Get-Location) 'dist'
if (-not (Test-Path (Join-Path $DistDir 'index.html'))) {
  throw "Vite build completed but dist\index.html is missing"
}

$redactedBundle = Get-ChildItem $DistDir -Recurse -File | Select-String -SimpleMatch '[SENSITIVE]' -List -ErrorAction SilentlyContinue
if ($redactedBundle) {
  throw 'Build output contains a redacted [SENSITIVE] placeholder. Deployment aborted before upload.'
}

Write-Host ""
Write-Host "Creating Vercel Build Output API artifact..." -ForegroundColor Cyan
$OutputDir = Join-Path (Get-Location) '.vercel\output'
$StaticDir = Join-Path $OutputDir 'static'
if (Test-Path $OutputDir) {
  Remove-Item $OutputDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $StaticDir | Out-Null
Copy-Item (Join-Path $DistDir '*') $StaticDir -Recurse -Force

$OutputConfig = @{
  version = 3
  routes = @(
    @{
      src = '/(.*)'
      headers = @{
        'Strict-Transport-Security' = 'max-age=63072000; includeSubDomains; preload'
        'X-Content-Type-Options' = 'nosniff'
        'X-Frame-Options' = 'DENY'
        'Referrer-Policy' = 'strict-origin-when-cross-origin'
        'Permissions-Policy' = 'camera=(), microphone=(), geolocation=()'
      }
      continue = $true
    },
    @{
      src = '/sw\.js'
      headers = @{
        'Cache-Control' = 'public, max-age=0, must-revalidate'
        'Service-Worker-Allowed' = '/'
      }
      continue = $true
    },
    @{
      src = '/manifest\.webmanifest'
      headers = @{ 'Cache-Control' = 'public, max-age=0, must-revalidate' }
      continue = $true
    },
    @{
      src = '/assets/(.*)'
      headers = @{ 'Cache-Control' = 'public, max-age=31536000, immutable' }
      continue = $true
    },
    @{ handle = 'filesystem' }
  )
}

$OutputConfigPath = Join-Path $OutputDir 'config.json'
$OutputConfigJson = $OutputConfig | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText(
  $OutputConfigPath,
  $OutputConfigJson,
  (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "Prepared .vercel/output/static and config.json" -ForegroundColor Green

Write-Host ""
Write-Host "Deploying prebuilt output to production..." -ForegroundColor Cyan
Invoke-Vercel deploy --prebuilt --prod --scope $Scope

Write-Host ""
Write-Host "Prebuilt production deployment completed." -ForegroundColor Green
