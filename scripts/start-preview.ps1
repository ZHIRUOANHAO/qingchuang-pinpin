param(
    [ValidateRange(1024, 65529)]
    [int]$Port = 4173,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$mutex = New-Object System.Threading.Mutex($false, 'Local\QingchuangPinpinPreviewStart')
$locked = $false

function Test-Preview([int]$Candidate) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Candidate/__preview_health" -TimeoutSec 1
        $health = $response.Content | ConvertFrom-Json
        return $health.service -eq 'qingchuang-pinpin-preview'
    } catch { return $false }
}

function Test-PortListening([int]$Candidate) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect('127.0.0.1', $Candidate)
        return $true
    } catch { return $false }
    finally { $client.Dispose() }
}

try {
    $locked = $mutex.WaitOne(15000)
    if (-not $locked) { throw 'Another preview launch is still in progress. Please try again shortly.' }

    $selectedPort = 0
    $running = $false
    foreach ($candidate in $Port..($Port + 5)) {
        if (Test-Preview $candidate) {
            $selectedPort = $candidate
            $running = $true
            break
        }
        if (-not (Test-PortListening $candidate)) {
            $selectedPort = $candidate
            break
        }
    }
    if (-not $selectedPort) { throw 'No free preview port found. No existing process was stopped.' }

    if (-not $running) {
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }
        if (-not $nodePath) {
            $nodePath = @(
                (Join-Path $env:LOCALAPPDATA 'hermes\node\node.exe'),
                (Join-Path $env:ProgramFiles 'nodejs\node.exe')
            ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        }
        if (-not $nodePath) { throw 'Node.js was not found. Install Node.js, then reopen this launcher.' }

        $logDirectory = Join-Path $projectRoot 'output\preview'
        New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
        $serverScript = Join-Path $PSScriptRoot 'serve-preview.mjs'
        # A separate hidden Windows process does not require the task terminal to stay open.
        try {
            $server = Start-Process -FilePath $nodePath -ArgumentList @(('"{0}"' -f $serverScript), "$selectedPort") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory "server-$selectedPort.log") -RedirectStandardError (Join-Path $logDirectory "server-$selectedPort-error.log") -PassThru
        } catch [System.ArgumentException] {
            # Some terminal hosts expose both Path and PATH. Windows PowerShell's
            # Start-Process tries to copy them into a case-insensitive dictionary
            # and crashes before Node starts. Direct Process.Start can inherit the
            # raw environment block without rebuilding that dictionary.
            if ($_.Exception.Message -notmatch 'Key in dictionary') { throw }
            $startInfo = New-Object System.Diagnostics.ProcessStartInfo
            $startInfo.FileName = $nodePath
            $startInfo.Arguments = ('"{0}" {1}' -f $serverScript, $selectedPort)
            $startInfo.WorkingDirectory = $projectRoot
            $startInfo.UseShellExecute = $false
            $startInfo.CreateNoWindow = $true
            $server = New-Object System.Diagnostics.Process
            $server.StartInfo = $startInfo
            if (-not $server.Start()) { throw 'Preview process could not be started.' }
        }

        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if (Test-Preview $selectedPort) { $running = $true; break }
            if ($server.HasExited) { break }
            Start-Sleep -Milliseconds 200
        }
        if (-not $running) { throw "Preview did not become ready. See logs in $logDirectory" }
    }

    $url = "http://127.0.0.1:$selectedPort/preview/"
    Write-Output "Preview ready: $url"
    if (-not $NoBrowser) { Start-Process -FilePath $url }
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
