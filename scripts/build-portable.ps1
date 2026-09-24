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
$ProfileOut = Join-Path $OutputPath 'profile'

New-Item -ItemType Directory -Force -Path $RuntimeOut, $DistributionOut, $ExtensionsOut, $ProfileOut | Out-Null

Write-Host 'Copio runtime Gecko/Firefox...'
Copy-Item -Path (Join-Path $FirefoxRuntimePath '*') -Destination $RuntimeOut -Recurse -Force

Write-Host 'Applico policy del browser...'
Copy-Item -Path (Join-Path $Root 'distribution\policies.json') -Destination (Join-Path $DistributionOut 'policies.json') -Force

Write-Host 'Creo profilo unico del browser...'
$CommonTemplate = Join-Path $Root 'profiles\templates\common'
$NormalTemplate = Join-Path $Root 'profiles\templates\normal'

$commonPrefs = Get-Content -Raw (Join-Path $CommonTemplate 'user.js')
$normalPrefs = Get-Content -Raw (Join-Path $NormalTemplate 'user.js')
Set-Content -Path (Join-Path $ProfileOut 'user.js') -Value ($commonPrefs + [Environment]::NewLine + $normalPrefs) -Encoding UTF8

$CommonChrome = Join-Path $CommonTemplate 'chrome'
if (Test-Path $CommonChrome) {
    Copy-Item -Path $CommonChrome -Destination $ProfileOut -Recurse -Force
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
