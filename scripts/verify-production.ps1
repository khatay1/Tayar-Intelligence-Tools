param(
  [string]$BaseUrl = 'https://www.tayar.se'
)

$ErrorActionPreference = 'Stop'

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
  Write-Host "PASS  $Message" -ForegroundColor Green
}

Write-Host ""
Write-Host "Tayar production verification" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl"
Write-Host ""

$home = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -MaximumRedirection 5
Assert-True ($home.StatusCode -eq 200) "Homepage returns HTTP 200"
Assert-True ($home.Content -match '<div id="root"') "SPA root is present"
Assert-True ($home.Content -match '/assets/') "Production assets are referenced"

$headers = $home.Headers
Assert-True ([string]$headers['Strict-Transport-Security'] -match 'max-age=63072000') "HSTS header is active"
Assert-True ([string]$headers['X-Content-Type-Options'] -eq 'nosniff') "nosniff header is active"
Assert-True ([string]$headers['X-Frame-Options'] -eq 'DENY') "frame protection is active"

$sw = Invoke-WebRequest -Uri "$BaseUrl/sw.js" -UseBasicParsing -MaximumRedirection 5
Assert-True ($sw.StatusCode -eq 200) "Service worker returns HTTP 200"
Assert-True ([string]$sw.Headers['Cache-Control'] -match 'must-revalidate') "Service worker cache policy is safe"
Assert-True ([string]$sw.Headers['Service-Worker-Allowed'] -eq '/') "Service worker scope header is correct"

$manifest = Invoke-WebRequest -Uri "$BaseUrl/manifest.webmanifest" -UseBasicParsing -MaximumRedirection 5
Assert-True ($manifest.StatusCode -eq 200) "Manifest returns HTTP 200"
Assert-True ([string]$manifest.Headers['Cache-Control'] -match 'must-revalidate') "Manifest cache policy is safe"

Write-Host ""
Write-Host "Production verification completed successfully." -ForegroundColor Green
