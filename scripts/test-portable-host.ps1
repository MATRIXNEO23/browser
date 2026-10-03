param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Before", "After")]
  [string]$Phase,

  [Parameter(Mandatory = $true)]
  [string]$SnapshotPath
)

$ErrorActionPreference = "Stop"

function Get-FilumHostSnapshot {
  $roots = @(
    (Join-Path $env:APPDATA "Mozilla\Firefox"),
    (Join-Path $env:APPDATA "Browser"),
    (Join-Path $env:LOCALAPPDATA "Mozilla\Firefox"),
    (Join-Path $env:LOCALAPPDATA "Browser"),
    (Join-Path $env:PROGRAMDATA "Mozilla"),
    (Join-Path $env:PROGRAMDATA "Browser"),
    (Join-Path $env:RUNNER_TEMP "Mozilla"),
    (Join-Path $env:RUNNER_TEMP "Browser")
  )

  $files = @()
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $files += "ROOT|$root"
    $files += Get-ChildItem -LiteralPath $root -Force -Recurse -ErrorAction SilentlyContinue |
      ForEach-Object { "$($_.FullName)|$($_.PSIsContainer)|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)" }
  }

  $registryRoots = @(
    "HKCU:\Software\Mozilla",
    "HKCU:\Software\Browser",
    "HKCU:\Software\FILUM",
    "HKLM:\Software\Mozilla",
    "HKLM:\Software\Browser",
    "HKLM:\Software\FILUM",
    "HKLM:\Software\WOW6432Node\Mozilla",
    "HKLM:\Software\WOW6432Node\Browser",
    "HKLM:\Software\WOW6432Node\FILUM"
  )
  $registry = @()
  foreach ($root in $registryRoots) {
    if (-not (Test-Path $root)) { continue }
    $registry += Get-Item -LiteralPath $root | ForEach-Object { "$($_.Name)|$($_.LastWriteTime.Ticks)" }
    $registry += Get-ChildItem -LiteralPath $root -Recurse -ErrorAction SilentlyContinue |
      ForEach-Object { "$($_.Name)|$($_.LastWriteTime.Ticks)" }
  }

  $services = @(Get-Service -ErrorAction SilentlyContinue |
    Where-Object { "$($_.Name) $($_.DisplayName)" -match "(?i)mozilla|firefox|filum" } |
    ForEach-Object { "$($_.Name)|$($_.Status)|$($_.StartType)" })

  $tasks = @()
  if (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue) {
    $tasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue |
      Where-Object { "$($_.TaskName) $($_.TaskPath) $($_.Description)" -match "(?i)mozilla|firefox|filum" } |
      ForEach-Object { "$($_.TaskPath)$($_.TaskName)|$($_.State)" })
  }

  return [ordered]@{
    files = @($files | Sort-Object -Unique)
    registry = @($registry | Sort-Object -Unique)
    services = @($services | Sort-Object -Unique)
    tasks = @($tasks | Sort-Object -Unique)
  }
}

$current = Get-FilumHostSnapshot
if ($Phase -eq "Before") {
  $current | ConvertTo-Json -Depth 4 | Set-Content -Path $SnapshotPath -Encoding utf8
  Write-Host "Captured baseline for known Mozilla/Firefox/Browser/FILUM host paths, registry roots, services and tasks."
  exit 0
}

if (-not (Test-Path $SnapshotPath)) { throw "Portable host baseline is missing: $SnapshotPath" }
$baseline = Get-Content -Path $SnapshotPath -Raw | ConvertFrom-Json
$changesFound = $false
foreach ($category in @("files", "registry", "services", "tasks")) {
  $before = @($baseline.$category)
  $after = @($current[$category])
  $added = @($after | Where-Object { $_ -notin $before })
  $changedOrRemoved = @($before | Where-Object { $_ -notin $after })
  if ($added.Count -or $changedOrRemoved.Count) {
    $changesFound = $true
    Write-Host "Host residuals in $category (added/changed):"
    $added | ForEach-Object { Write-Host "  + $_" }
    $changedOrRemoved | ForEach-Object { Write-Host "  - $_" }
  }
}
if (-not $changesFound) {
  Write-Host "No changes found in the audited external paths, registry roots, services or scheduled tasks."
} else {
  throw "Portable host audit found external paths, registry, service or scheduled-task changes. Review the reported differences."
}
