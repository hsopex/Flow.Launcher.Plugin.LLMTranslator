$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$plugin = Get-Content -LiteralPath (Join-Path $projectRoot 'plugin.json') -Raw | ConvertFrom-Json
$releaseName = "Flow.Launcher.Plugin.LLMTranslator-$($plugin.Version)"
$distDirectory = Join-Path $projectRoot 'dist'
$stageDirectory = Join-Path $distDirectory $releaseName
$archivePath = Join-Path $distDirectory "$releaseName.zip"

if (Test-Path -LiteralPath $stageDirectory) {
    Remove-Item -LiteralPath $stageDirectory -Recurse -Force
}
if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}

New-Item -ItemType Directory -Path $stageDirectory -Force | Out-Null

$files = @(
    'main.js',
    'plugin.json',
    'SettingsTemplate.yaml',
    'package.json',
    'README.md',
    'LICENSE'
)

foreach ($file in $files) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $stageDirectory
}

Copy-Item -LiteralPath (Join-Path $projectRoot 'src') -Destination $stageDirectory -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'Images') -Destination $stageDirectory -Recurse
Compress-Archive -Path (Join-Path $stageDirectory '*') -DestinationPath $archivePath -CompressionLevel Optimal

Write-Output $archivePath
