param([switch]$Publish)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$ffmpeg = Join-Path $taskRoot 'node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe'
$ffprobe = Join-Path $taskRoot 'node_modules/@ffprobe-installer/win32-x64/ffprobe.exe'
$source = Join-Path $taskRoot 'renders/promo-master.mp4'
$promoName = -join ([char[]](0x8F7B,0x521B,0x62FC,0x62FC))
$promoName += '-' + (-join ([char[]](0x5BA3,0x4F20,0x7247))) + '.mp4'
$output = Join-Path (Join-Path $taskRoot 'renders') $promoName
$duration = 50.3
$frames = 1509
function Invoke-TaskFfmpeg {
  param([string[]]$Arguments)
  # Windows PowerShell 5.1 wraps ordinary native stderr in ErrorRecord objects.
  # ffmpeg writes its successful progress there; use its exit code as authority.
  $ErrorActionPreference = 'Continue'
  $taskNativeLines = & $ffmpeg @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw ('FFmpeg failed: ' + ($taskNativeLines | Out-String)) }
  return ($taskNativeLines | Out-String)
}
if (!(Test-Path -LiteralPath $ffmpeg) -or !(Test-Path -LiteralPath $ffprobe)) { throw 'Local media tools missing' }
if (!(Test-Path -LiteralPath $source)) { throw 'Master render is missing' }
$audit = (& $ffprobe -v error -show_format -show_streams -of json $source | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'Master probe failed' }
$video = $audit.streams | Where-Object codec_type -eq 'video'
$sourceFrames = [int]$video.nb_frames
if ($sourceFrames -lt $frames -or $sourceFrames -gt ($frames + 1) -or [math]::Abs([double]$audit.format.duration - $duration) -gt 0.07) { throw 'Master does not match current edit; publication stopped' }
# The assembler rounds scene boundaries to milliseconds (50.301s), so the
# renderer may ceil to 1510 frames. Remove only that bounded final hold frame.
$measureText = Invoke-TaskFfmpeg -Arguments @('-hide_banner','-i',$source,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','NUL')
$match = [regex]::Match($measureText, '(?s)\{\s*"input_i".*?\}')
if (!$match.Success) { throw 'Missing loudness measurement' }
$levels = $match.Value | ConvertFrom-Json
$filter = 'loudnorm=I=-16:TP=-1.5:LRA=7:measured_I={0}:measured_TP={1}:measured_LRA={2}:measured_thresh={3}:offset={4}:linear=true,aformat=sample_rates=48000:channel_layouts=stereo' -f $levels.input_i,$levels.input_tp,$levels.input_lra,$levels.input_thresh,$levels.target_offset
Invoke-TaskFfmpeg -Arguments @('-hide_banner','-y','-i',$source,'-map','0:v:0','-map','0:a:0','-map_metadata','-1','-c:v','copy','-frames:v',"$frames",'-t',"$duration",'-af',$filter,'-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',$output) | Out-Null
Invoke-TaskFfmpeg -Arguments @('-v','error','-i',$output,'-f','null','NUL') | Out-Null
$probe = (& $ffprobe -v error -show_format -show_streams -of json $output | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'Delivery probe failed' }
$v = $probe.streams | Where-Object codec_type -eq 'video'
$a = $probe.streams | Where-Object codec_type -eq 'audio'
if ($v.codec_name -ne 'h264' -or $v.width -ne 1080 -or $v.height -ne 1920 -or $v.pix_fmt -ne 'yuv420p' -or $v.avg_frame_rate -ne '30/1' -or [int]$v.nb_frames -ne $frames) { throw 'Delivery video spec failed' }
if ($a.codec_name -ne 'aac' -or $a.sample_rate -ne '48000' -or $a.channels -ne 2) { throw 'Delivery audio spec failed' }
if ([math]::Abs([double]$probe.format.duration - $duration) -gt 0.07) { throw 'Delivery duration failed' }
$postText = Invoke-TaskFfmpeg -Arguments @('-hide_banner','-i',$output,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','NUL')
$postMatch = [regex]::Match($postText,'(?s)\{\s*"input_i".*?\}')
if (!$postMatch.Success) { throw 'Post loudness data missing' }
$post = $postMatch.Value | ConvertFrom-Json
if ([math]::Abs([double]$post.input_i + 16) -gt 1 -or [double]$post.input_tp -gt -0.8) { throw 'Loudness or peak check failed' }
$hash = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash
$target = $null
if ($Publish) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $folder = Join-Path $desktop (-join ([char[]](0x89C6,0x9891,0x6210,0x54C1)))
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
  $target = Join-Path $folder $promoName
  if (Test-Path -LiteralPath $target) {
    $existingHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
    if ($existingHash -ne $hash) { throw 'A different same-name product promo already exists; preserve it and request direction' }
  } else {
    Copy-Item -LiteralPath $output -Destination $target
  }
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $hash) { throw 'Desktop copy hash mismatch' }
}
$report = [ordered]@{version='0.1';last_updated='2026-10-08';source=$source;source_frames=$sourceFrames;removed_end_hold_frames=($sourceFrames - $frames);output=$output;desktop=$target;duration=[double]$probe.format.duration;frames=$frames;size=(Get-Item -LiteralPath $output).Length;sha256=$hash;video=$v;audio=$a;loudness=$post;full_decode='passed';published=[bool]$Publish}
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $taskRoot 'renders/delivery-audit.json') -Encoding UTF8
Write-Output ($report | ConvertTo-Json -Depth 2 -Compress)
