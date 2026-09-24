param(
    [Parameter(Mandatory = $true)]
    [string]$FirefoxRuntimePath,
    [string]$OutputPath = '',
    [switch]$SkipLauncherBuild
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $OutputPath) { $OutputPath = Join-Path $Root 'dist\Browser' }

$FirefoxRuntimePath = (Resolve-Path $FirefoxRuntimePath).Path
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)

if (-not (Test-Path (Join-Path $FirefoxRuntimePath 'firefox.exe'))) {
    throw 'Il percorso runtime non contiene firefox.exe.'
}

if (Test-Path $OutputPath) { Remove-Item -Recurse -Force $OutputPath }

$RuntimeOut = Join-Path $OutputPath 'runtime\firefox'
$DistributionOut = Join-Path $RuntimeOut 'distribution'
$ExtensionsOut = Join-Path $DistributionOut 'extensions'
$ProfilesOut = Join-Path $OutputPath 'profiles'

New-Item -ItemType Directory -Force -Path $RuntimeOut, $DistributionOut, $ExtensionsOut, $ProfilesOut | Out-Null

Write-Host 'Copio runtime Gecko/Firefox...'
Copy-Item -Path (Join-Path $FirefoxRuntimePath '*') -Destination $RuntimeOut -Recurse -Force

Write-Host 'Applico policy del browser...'
Copy-Item -Path (Join-Path $Root 'distribution\policies.json') -Destination (Join-Path $DistributionOut 'policies.json') -Force

Write-Host 'Creo profili iniziali...'
foreach ($mode in @('normal', 'turbo', 'private', 'ghost')) {
    $dest = Join-Path $ProfilesOut $mode
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Path (Join-Path $Root ('profiles\templates\' + $mode + '\user.js')) -Destination (Join-Path $dest 'user.js') -Force
}

Write-Host 'Impacchetto componente interno...'
$TempZip = Join-Path $env:TEMP 'matrixneo23-browser-extension.zip'
$XpiPath = Join-Path $ExtensionsOut 'resource-controller@matrixneo23.browser.xpi'
if (Test-Path $TempZip) { Remove-Item -Force $TempZip }
if (Test-Path $XpiPath) { Remove-Item -Force $XpiPath }
Compress-Archive -Path (Join-Path $Root 'extension\*') -DestinationPath $TempZip -CompressionLevel Optimal
Move-Item -Path $TempZip -Destination $XpiPath -Force

if (-not $SkipLauncherBuild) {
    $cl = Get-Command cl.exe -ErrorAction SilentlyContinue
    if (-not $cl) {
        throw 'cl.exe non trovato. Avvia il Developer Command Prompt di Visual Studio oppure usa -SkipLauncherBuild.'
    }
    Push-Location $Root
    try {
        & $cl.Source /nologo /std:c++17 /O2 /EHsc /DUNICODE /D_UNICODE /Fe:$OutputPath\Browser.exe src\launcher\main.cpp user32.lib
        if ($LASTEXITCODE -ne 0) { throw 'Compilazione Browser.exe fallita.' }
    }
    finally { Pop-Location }
}

Write-Host ''
Write-Host 'Browser portable assemblato in:'
Write-Host $OutputPath
Write-Host ''
Write-Host 'Nota: per una release finale, il componente XPI interno deve rispettare i requisiti di firma Firefox.'
