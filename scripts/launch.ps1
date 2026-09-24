param(
    [ValidateSet('NORMAL','TURBO','PRIVATE','GHOST')]
    [string]$Mode = 'NORMAL',
    [string]$FirefoxPath = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Runtime = Join-Path $Root '.runtime'
$Profiles = Join-Path $Runtime 'profiles'
$Profile = Join-Path $Profiles $Mode.ToLowerInvariant()

if (-not $FirefoxPath) {
    $candidates = @(
        (Join-Path $env:ProgramFiles 'Mozilla Firefox\firefox.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Mozilla Firefox\firefox.exe')
    )
    $FirefoxPath = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}

if (-not $FirefoxPath -or -not (Test-Path $FirefoxPath)) {
    throw "Firefox non trovato. Passa -FirefoxPath 'C:\percorso\firefox.exe'."
}

New-Item -ItemType Directory -Force -Path $Profile | Out-Null

$prefs = @(
    'user_pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);',
    'user_pref("browser.newtabpage.activity-stream.showSponsored", false);',
    'user_pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);',
    'user_pref("browser.tabs.unloadOnLowMemory", true);',
    'user_pref("network.prefetch-next", false);',
    'user_pref("network.dns.disablePrefetch", true);',
    'user_pref("privacy.trackingprotection.enabled", true);',
    'user_pref("privacy.trackingprotection.socialtracking.enabled", true);',
    'user_pref("network.cookie.cookieBehavior", 5);'
)

switch ($Mode) {
    'NORMAL' {
        $prefs += 'user_pref("privacy.resistFingerprinting", false);'
    }
    'TURBO' {
        $prefs += 'user_pref("media.autoplay.default", 5);'
        $prefs += 'user_pref("network.http.speculative-parallel-limit", 0);'
        $prefs += 'user_pref("privacy.resistFingerprinting", false);'
    }
    'PRIVATE' {
        $prefs += 'user_pref("privacy.trackingprotection.fingerprinting.enabled", true);'
        $prefs += 'user_pref("privacy.trackingprotection.cryptomining.enabled", true);'
    }
    'GHOST' {
        $prefs += 'user_pref("privacy.resistFingerprinting", true);'
        $prefs += 'user_pref("privacy.trackingprotection.fingerprinting.enabled", true);'
        $prefs += 'user_pref("privacy.trackingprotection.cryptomining.enabled", true);'
        $prefs += 'user_pref("browser.privatebrowsing.autostart", true);'
    }
}

Set-Content -Path (Join-Path $Profile 'user.js') -Value ($prefs -join "`r`n") -Encoding UTF8
Write-Host "Browser mode: $Mode"
Write-Host "Profile: $Profile"
& $FirefoxPath -profile $Profile -no-remote