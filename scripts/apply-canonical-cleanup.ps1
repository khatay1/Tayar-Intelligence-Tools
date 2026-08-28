$ErrorActionPreference = 'Stop'

$paths = @(
  '.bolt',
  'dist',
  'db-data.sql',
  'public/icon-512.webp',
  'scripts/upgrade-website-builder-ai.ps1',
  'src/components/Dashboard.tsx',
  'src/components/ui/GlassCard.tsx',
  'src/components/workspace/GlobalSearch.tsx',
  'src/components/workspace/AISettings.tsx',
  'src/lib/ai/image-service.ts',
  'src/lib/errors.ts'
)

foreach ($path in $paths) {
  if (Test-Path $path) {
    Remove-Item $path -Recurse -Force
    Write-Host "Removed $path"
  }
}

Write-Host 'Canonical cleanup complete. Run git status to review the exact changes.'
