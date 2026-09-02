param(
  [string]$BaseUrl = 'https://tayar.se'
)

$ErrorActionPreference = 'Stop'

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw "FAIL  $Message" }
  Write-Host "PASS  $Message" -ForegroundColor Green
}

function Get-HeaderValue {
  param($Headers, [string]$Name)
  if ($null -eq $Headers) { return '' }
  $value = $Headers[$Name]
  if ($value -is [System.Array]) { return ($value -join ', ') }
  return [string]$value
}

$base = $BaseUrl.TrimEnd('/')
Write-Host ""
Write-Host "Tayar production verification" -ForegroundColor Cyan
Write-Host "Target: $base"
Write-Host ""

$home = Invoke-WebRequest -Uri $base -UseBasicParsing -MaximumRedirection 5
Assert-True ($home.StatusCode -eq 200) "Homepage returns HTTP 200"
Assert-True ($home.Content -match '<div\s+id=["'']root["'']') "SPA root is present"
Assert-True ($home.Content -match '/assets/') "Production assets are referenced"

$headers = $home.Headers
Assert-True ((Get-HeaderValue $headers 'Strict-Transport-Security') -match 'max-age=63072000') "HSTS header is active"
Assert-True ((Get-HeaderValue $headers 'X-Content-Type-Options') -eq 'nosniff') "nosniff header is active"
Assert-True ((Get-HeaderValue $headers 'X-Frame-Options') -eq 'DENY') "frame protection is active"
Assert-True ((Get-HeaderValue $headers 'Referrer-Policy') -match 'strict-origin-when-cross-origin') "referrer policy is active"
Assert-True ((Get-HeaderValue $headers 'Permissions-Policy') -ne '') "permissions policy is active"

$sw = Invoke-WebRequest -Uri "$base/sw.js" -UseBasicParsing -MaximumRedirection 5
Assert-True ($sw.StatusCode -eq 200) "Service worker returns HTTP 200"
Assert-True ((Get-HeaderValue $sw.Headers 'Cache-Control') -match 'max-age=0') "Service worker is revalidated"
Assert-True ((Get-HeaderValue $sw.Headers 'Service-Worker-Allowed') -eq '/') "Service worker scope header is correct"

$manifest = Invoke-WebRequest -Uri "$base/manifest.webmanifest" -UseBasicParsing -MaximumRedirection 5
Assert-True ($manifest.StatusCode -eq 200) "Manifest returns HTTP 200"
Assert-True ((Get-HeaderValue $manifest.Headers 'Cache-Control') -match 'max-age=0') "Manifest is revalidated"

$robots = Invoke-WebRequest -Uri "$base/robots.txt" -UseBasicParsing -MaximumRedirection 5
Assert-True ($robots.StatusCode -eq 200) "robots.txt returns HTTP 200"
Assert-True ($robots.Content -match 'sitemap\.xml') "robots.txt advertises sitemap"

$sitemap = Invoke-WebRequest -Uri "$base/sitemap.xml" -UseBasicParsing -MaximumRedirection 5
Assert-True ($sitemap.StatusCode -eq 200) "sitemap.xml returns HTTP 200"
Assert-True ($sitemap.Content -match '<urlset') "sitemap.xml contains a URL set"

Write-Host ""
Write-Host "Production verification completed successfully." -ForegroundColor Green
