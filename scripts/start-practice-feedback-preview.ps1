param(
    [ValidateRange(1024, 65529)]
    [int]$Port = 4173,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$entry = Join-Path $projectRoot 'preview\practice-feedback\index.html'
if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) {
    throw 'The practice-feedback preview entry was not found in this project.'
}

# Reuse the existing project server; it handles port conflicts without
# stopping other processes. The current release preview remains unchanged.
$messages = @(& (Join-Path $PSScriptRoot 'start-preview.ps1') -Port $Port -NoBrowser)
$ready = $messages | Where-Object { "$_" -match '^Preview ready: http://127\.0\.0\.1:\d+/preview/$' } | Select-Object -Last 1
if (-not $ready) { throw 'The project preview server did not return a ready URL.' }
$baseUrl = "$ready" -replace '^Preview ready: ', ''
$url = $baseUrl + 'practice-feedback/'
$response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 5
if ($response.StatusCode -ne 200 -or $response.Content -notmatch 'id="case-grid"') {
    throw 'The practice-feedback preview could not be verified.'
}

Write-Output "Practice feedback preview ready: $url"
if (-not $NoBrowser) { Start-Process -FilePath $url }
