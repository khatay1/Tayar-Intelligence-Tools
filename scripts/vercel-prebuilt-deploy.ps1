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
Write-Host "Building locally for production..." -ForegroundColor Cyan
Write-Host "Using command processor: $env:ComSpec" -ForegroundColor DarkGray
Write-Host "Using npm script shell: $env:npm_config_script_shell" -ForegroundColor DarkGray

# Prove the exact child-process path Vercel/npm will need before entering build.
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  & node.exe -e "const {spawnSync}=require('node:child_process'); const p=spawnSync(process.env.npm_config_script_shell,['/d','/s','/c','echo cmd-ok'],{encoding:'utf8'}); if(p.error){console.error(p.error); process.exit(1)}; process.stdout.write(p.stdout||''); process.exit(p.status||0)" 2>&1 |
    ForEach-Object { Write-Host $_ }
  $cmdProbeExit = $LASTEXITCODE
}
finally {
  $ErrorActionPreference = $previousErrorAction
}
if ($cmdProbeExit -ne 0) {
  throw "Node could not launch the configured command processor: $env:npm_config_script_shell"
}

Invoke-Vercel build --prod --scope $Scope

Write-Host ""
Write-Host "Deploying prebuilt output to production..." -ForegroundColor Cyan
Invoke-Vercel deploy --prebuilt --prod --scope $Scope

Write-Host ""
Write-Host "Prebuilt production deployment completed." -ForegroundColor Green
