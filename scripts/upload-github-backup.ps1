param(
  [string]$Repository = 'ZHIRUOANHAO/qingchuang-pinpin',
  [string]$ExpectedLogin = 'ZHIRUOANHAO',
  [string]$Tag = 'backup-2026-10-26',
  [string]$AssetsDirectory = 'output/github-backup-2026-10-26',
  [string]$Proxy = 'http://127.0.0.1:7897',
  [string]$UploadProxy = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$qcppProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $qcppProjectRoot
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Invalid repository name' }
$qcppAssetsRoot = [IO.Path]::GetFullPath((Join-Path $qcppProjectRoot $AssetsDirectory))
if (-not $qcppAssetsRoot.StartsWith($qcppProjectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Assets must remain inside the project' }
$qcppChecksumsPath = Join-Path $qcppAssetsRoot 'SHA256SUMS.txt'
$qcppFiles = @()
foreach ($qcppChecksumLine in (Get-Content -LiteralPath $qcppChecksumsPath -Encoding UTF8)) {
  if ($qcppChecksumLine -notmatch '^([a-fA-F0-9]{64})  ([^/\\]+)$') { throw 'Invalid checksum entry' }
  $qcppExpectedHash = $Matches[1].ToLowerInvariant()
  $qcppAssetName = $Matches[2]
  $qcppAssetPath = Join-Path $qcppAssetsRoot $qcppAssetName
  $qcppHash = (Get-FileHash -LiteralPath $qcppAssetPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($qcppHash -ne $qcppExpectedHash) { throw "Checksum mismatch: $qcppAssetName" }
  $qcppFiles += [PSCustomObject]@{ Name=$qcppAssetName; Path=$qcppAssetPath; Sha256=$qcppHash; Bytes=(Get-Item -LiteralPath $qcppAssetPath).Length }
}
$qcppFiles += [PSCustomObject]@{ Name='SHA256SUMS.txt'; Path=$qcppChecksumsPath; Sha256=(Get-FileHash -LiteralPath $qcppChecksumsPath -Algorithm SHA256).Hash.ToLowerInvariant(); Bytes=(Get-Item -LiteralPath $qcppChecksumsPath).Length }

$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'Never'
$qcppCredential = @{}
$qcppHeaders = @{}
try {
  # Reuse Git Credential Manager. Never print credentials or open an account login flow.
  $qcppAuthInput = "protocol=https`nhost=github.com`nusername=$ExpectedLogin`n`n"
  $qcppCredentialOutput = $qcppAuthInput | git credential fill
  if ($LASTEXITCODE -ne 0) { throw 'Existing GitHub credential unavailable' }
  foreach ($qcppLine in $qcppCredentialOutput) {
    $qcppPair = $qcppLine -split '=',2
    if ($qcppPair.Count -eq 2) { $qcppCredential[$qcppPair[0]] = $qcppPair[1] }
  }
  $qcppCredentialOutput = $null
  $qcppHeaders = @{ Authorization='Bearer ' + $qcppCredential['password']; Accept='application/vnd.github+json'; 'User-Agent'='qingchuang-pinpin-backup'; 'X-GitHub-Api-Version'='2022-11-28' }
  $qcppRequest = @{ Headers=$qcppHeaders; Proxy=$Proxy; TimeoutSec=1800 }
  $qcppUser = Invoke-RestMethod @qcppRequest -Uri 'https://api.github.com/user'
  if ($qcppUser.login -ne $ExpectedLogin) { throw 'Existing credential belongs to a different GitHub account' }
  $qcppApiRoot = "https://api.github.com/repos/$Repository"
  $qcppRepo = Invoke-RestMethod @qcppRequest -Uri $qcppApiRoot
  if (-not $qcppRepo.private -or -not $qcppRepo.permissions.push) { throw 'Expected a writable private backup repository' }
  $qcppLocalCommit = (& git rev-parse HEAD).Trim()
  $qcppLocalTag = (& git rev-parse "$Tag^{}").Trim()
  if ($LASTEXITCODE -ne 0 -or $qcppLocalTag -ne $qcppLocalCommit) { throw 'Backup tag does not point to the current commit' }
  $qcppRemoteCommit = Invoke-RestMethod @qcppRequest -Uri "$qcppApiRoot/commits/$([Uri]::EscapeDataString($Tag))"
  if ($qcppRemoteCommit.sha -ne $qcppLocalCommit) { throw 'Remote backup tag does not match the local snapshot' }

  $qcppReleases = @(Invoke-RestMethod @qcppRequest -Uri "$qcppApiRoot/releases?per_page=100")
  $qcppRelease = $qcppReleases | Where-Object { $_.tag_name -eq $Tag } | Select-Object -First 1
  if (-not $qcppRelease) {
    $qcppBody = @{
      tag_name=$Tag
      name='Project backup 2026-10-26'
      body="Private project backup. Source snapshot: $qcppLocalCommit. Historical archives and independent working copies are catalogued in backups/catalog.json. Original local backups are preserved; machine-private configuration is excluded from upload copies. SHA256SUMS.txt verifies every asset. This is a backup snapshot, not a WeChat deployment. The seven issues in docs/other audit report remain open; see docs/ for the full Chinese audit."
      draft=$false
      prerelease=$false
      make_latest='false'
    } | ConvertTo-Json
    $qcppRelease = Invoke-RestMethod @qcppRequest -Method Post -Uri "$qcppApiRoot/releases" -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($qcppBody))
  }
  $qcppReceipts = @()
  foreach ($qcppFile in $qcppFiles) {
    $qcppExisting = @($qcppRelease.assets) | Where-Object { $_.name -eq $qcppFile.Name } | Select-Object -First 1
    if ($qcppExisting) {
      if ($qcppExisting.size -ne $qcppFile.Bytes -or ($qcppExisting.digest -and $qcppExisting.digest -ne ('sha256:' + $qcppFile.Sha256))) { throw "A different asset already exists; preserved without replacement: $($qcppFile.Name)" }
      $qcppAsset = $qcppExisting
      Write-Output "Reusing existing asset: $($qcppFile.Name)"
    } else {
      Write-Output "Uploading $($qcppFile.Name) ($($qcppFile.Bytes) bytes)"
      $qcppUploadUrl = "https://uploads.github.com/repos/$Repository/releases/$($qcppRelease.id)/assets?name=$([Uri]::EscapeDataString($qcppFile.Name))"
      $qcppHeaderText = "Authorization: Bearer $($qcppCredential['password'])`nAccept: application/vnd.github+json`nContent-Type: application/octet-stream`nExpect:`nUser-Agent: qingchuang-pinpin-backup"
      $qcppResponsePath = Join-Path $qcppAssetsRoot ($qcppFile.Name + '.response.json')
      $qcppProgressPath = Join-Path $qcppAssetsRoot ($qcppFile.Name + '.progress.log')
      $qcppCurlArgs = @('--http1.1','--connect-timeout','30','--max-time','1800','--speed-limit','1024','--speed-time','60','--progress-bar','--stderr',$qcppProgressPath,'--header','@-','--request','POST','--upload-file',$qcppFile.Path,'--output',$qcppResponsePath,'--write-out','%{http_code}')
      if ($UploadProxy) { $qcppCurlArgs += @('--proxy',$UploadProxy) } else { $qcppCurlArgs += @('--noproxy','*') }
      $qcppCurlArgs += $qcppUploadUrl
      $qcppStatus = $qcppHeaderText | & curl.exe @qcppCurlArgs
      $qcppHeaderText = $null
      if ($LASTEXITCODE -ne 0 -or [string]$qcppStatus -ne '201') { throw "Upload failed: $($qcppFile.Name) (HTTP $qcppStatus); see local progress log" }
      $qcppAsset = Get-Content -LiteralPath $qcppResponsePath -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    if ($qcppAsset.size -ne $qcppFile.Bytes -or $qcppAsset.state -ne 'uploaded') { throw "Remote asset not complete: $($qcppFile.Name)" }
    $qcppVerification = 'github-sha256'
    if ($qcppAsset.digest) {
      if ($qcppAsset.digest -ne ('sha256:' + $qcppFile.Sha256)) { throw "Remote digest mismatch: $($qcppFile.Name)" }
    } else {
      $qcppVerifiedRoot = Join-Path $qcppAssetsRoot 'verified-downloads'
      New-Item -ItemType Directory -Path $qcppVerifiedRoot -Force | Out-Null
      $qcppVerifiedFile = Join-Path $qcppVerifiedRoot $qcppFile.Name
      $qcppDownloadHeaders = $qcppHeaders.Clone()
      $qcppDownloadHeaders.Accept = 'application/octet-stream'
      Invoke-WebRequest -UseBasicParsing -Uri $qcppAsset.url -Headers $qcppDownloadHeaders -Proxy $Proxy -TimeoutSec 1800 -OutFile $qcppVerifiedFile
      if ((Get-FileHash -LiteralPath $qcppVerifiedFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $qcppFile.Sha256) { throw "Downloaded digest mismatch: $($qcppFile.Name)" }
      $qcppVerification = 'downloaded-sha256'
    }
    $qcppReceipts += [PSCustomObject]@{ name=$qcppFile.Name; bytes=$qcppAsset.size; sha256=$qcppFile.Sha256; verification=$qcppVerification; assetId=$qcppAsset.id; url=$qcppAsset.browser_download_url }
    Write-Output "Verified $($qcppFile.Name): $qcppVerification"
  }
  $qcppRemoteRelease = Invoke-RestMethod @qcppRequest -Uri "$qcppApiRoot/releases/$($qcppRelease.id)"
  if (@($qcppRemoteRelease.assets).Count -lt $qcppFiles.Count) { throw 'Remote release asset list is incomplete' }
  $qcppReceipt = @{ version='0.1'; last_updated='2026-10-26'; login=$qcppUser.login; repository=$Repository; commit=$qcppLocalCommit; tag=$Tag; releaseUrl=$qcppRelease.html_url; assets=$qcppReceipts }
  $qcppReceiptJson = $qcppReceipt | ConvertTo-Json -Depth 8
  [IO.File]::WriteAllText((Join-Path $qcppAssetsRoot 'upload-receipt.json'), $qcppReceiptJson, (New-Object Text.UTF8Encoding($false)))
  Write-Output $qcppReceiptJson
} finally {
  $qcppCredentialOutput = $null
  $qcppCredential.Clear()
  $qcppHeaders.Clear()
}
