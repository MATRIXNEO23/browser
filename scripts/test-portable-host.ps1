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

function Test-ExpectedGeckoHostResidue {
  param(
    [Parameter(Mandatory = $true)][string]$Category,
    [Parameter(Mandatory = $true)][string]$Entry
  )

  if ($Category -eq "files") {
    $parts = $Entry -split "\|"
    $path = if ($parts[0] -eq "ROOT") { $parts[1] } else { $parts[0] }
    $expectedPaths = @(
      (Join-Path $env:APPDATA "Mozilla\Firefox"),
      (Join-Path $env:LOCALAPPDATA "Mozilla\Firefox"),
      (Join-Path $env:APPDATA "Mozilla\Firefox\Crash Reports"),
      (Join-Path $env:APPDATA "Mozilla\Firefox\Crash Reports\events"),
      (Join-Path $env:APPDATA "Mozilla\Firefox\Crash Reports\crash_helper_server.log"),
      (Join-Path $env:APPDATA "Mozilla\Firefox\Pending Pings")
    )
    if ($path -in $expectedPaths) { return $true }

    # Gecko's defaultagent task uses a persistent, non-browsing profile by design.
    # Allow only its known crash/telemetry directories; all other profile data
    # such as prefs, databases, cookies, and history remains an audit failure.
    $taskProfiles = Join-Path $env:APPDATA "Mozilla\Firefox\Background Tasks Profiles"
    if ($path -eq $taskProfiles) { return $true }
    $prefix = [regex]::Escape($taskProfiles) + "\\([^\\]+MozillaBackgroundTask-[A-Fa-f0-9]+-defaultagent)(?:\\(.*))?$"
    $match = [regex]::Match($path, $prefix, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
      $relative = $match.Groups[2].Value.Replace("/", "\\").TrimEnd("\\")
      if (-not $relative) { return $true }
      return $relative -in @(
        "crashes",
        "datareporting",
        "datareporting\glean",
        "datareporting\glean\tmp"
      )
    }
    return $false
  }

  if ($Category -eq "registry") {
    $path = ($Entry -split "\|")[0]
    $expectedKeys = @(
      "HKEY_CURRENT_USER\Software\Mozilla",
      "HKEY_CURRENT_USER\Software\Mozilla\browser",
      "HKEY_CURRENT_USER\Software\Mozilla\browser\Installer",
      "HKEY_CURRENT_USER\Software\Mozilla\Firefox",
      "HKEY_CURRENT_USER\Software\Mozilla\Firefox\Default Browser Agent",
      "HKEY_CURRENT_USER\Software\Mozilla\Firefox\DllPrefetchExperiment",
      "HKEY_CURRENT_USER\Software\Mozilla\Firefox\Launcher",
      "HKEY_CURRENT_USER\Software\Mozilla\Firefox\PreXULSkeletonUISettings"
    )
    if ($path -in $expectedKeys) { return $true }
    return $path -match '^HKEY_CURRENT_USER\\Software\\Mozilla\\browser\\Installer\\[0-9A-F]{16}$'
  }

  return $false
}

$current = Get-FilumHostSnapshot
if ($Phase -eq "Before") {
  $current | ConvertTo-Json -Depth 4 | Set-Content -Path $SnapshotPath -Encoding utf8
  Write-Host "Captured baseline for known Mozilla/Firefox/Browser/FILUM host paths, registry roots, services and tasks."
  exit 0
}

if (-not (Test-Path $SnapshotPath)) { throw "Portable host baseline is missing: $SnapshotPath" }
$baseline = Get-Content -Path $SnapshotPath -Raw | ConvertFrom-Json
$unexpectedChanges = @()
$expectedResidues = @()
foreach ($category in @("files", "registry", "services", "tasks")) {
  $before = @($baseline.$category)
  $after = @($current[$category])
  $added = @($after | Where-Object { $_ -notin $before })
  $changedOrRemoved = @($before | Where-Object { $_ -notin $after })
  foreach ($entry in @($added + $changedOrRemoved)) {
    if (Test-ExpectedGeckoHostResidue -Category $category -Entry $entry) {
      $expectedResidues += "$category|$entry"
    } else {
      $unexpectedChanges += "$category|$entry"
    }
  }
}

if ($expectedResidues.Count) {
  Write-Host "Known Gecko task metadata classified; no external browsing profile accepted:"
  $expectedResidues | ForEach-Object { Write-Host "  ~ $_" }
}
if ($unexpectedChanges.Count) {
  Write-Host "Unexpected host changes:"
  $unexpectedChanges | ForEach-Object { Write-Host "  ! $_" }
  throw "Portable host audit found unclassified profile, registry, service or scheduled-task changes."
}
Write-Host "Portable host audit: no external browsing profile, unexpected registry changes, service or scheduled-task changes."
