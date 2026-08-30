#Requires -Version 5.1

<#
.SYNOPSIS
    Creates an installable Flow Launcher plugin ZIP.

.PARAMETER OutputDirectory
    Directory where the ZIP will be written. Relative paths are resolved from
    the project root. Defaults to the project's dist directory.

.PARAMETER VersionLabel
    Version text used in the ZIP filename. Defaults to v<plugin.json Version>.
#>

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$OutputDirectory = 'dist',

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$VersionLabel
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$PluginManifestPath = Join-Path $ProjectRoot 'plugin.json'
$PluginManifest = Get-Content -LiteralPath $PluginManifestPath -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($PluginManifest.Version)) {
    throw 'plugin.json does not contain a valid Version.'
}

if ([string]::IsNullOrWhiteSpace($VersionLabel)) {
    $VersionLabel = "v$($PluginManifest.Version)"
}

if ($VersionLabel -notmatch '^[0-9A-Za-z._-]+$') {
    throw "VersionLabel contains unsupported filename characters: $VersionLabel"
}

if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
    $ResolvedOutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
}
else {
    $ResolvedOutputDirectory = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $OutputDirectory))
}

$ArtifactName = "Flow.Launcher.Plugin.LLMTranslator-$VersionLabel.zip"
$ArtifactPath = Join-Path $ResolvedOutputDirectory $ArtifactName
$TemporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "flow-llm-translator-package-$([guid]::NewGuid().ToString('N'))"
$StagingDirectory = Join-Path $TemporaryRoot 'plugin'
$ResolvedTemporaryRoot = [System.IO.Path]::GetFullPath($TemporaryRoot)
$SystemTemporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())

if (-not $ResolvedTemporaryRoot.StartsWith($SystemTemporaryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to use a staging directory outside the system temporary directory: $ResolvedTemporaryRoot"
}

$RuntimeFiles = @(
    'plugin.json'
    'SettingsTemplate.yaml'
    'main.js'
    'package.json'
    'README.md'
    'LICENSE'
)

$RuntimeDirectories = @(
    'src'
    'Images'
)

try {
    New-Item -ItemType Directory -Path $StagingDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path $ResolvedOutputDirectory -Force | Out-Null

    foreach ($RelativePath in $RuntimeFiles) {
        $SourcePath = Join-Path $ProjectRoot $RelativePath
        if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
            throw "Required runtime file is missing: $RelativePath"
        }
        Copy-Item -LiteralPath $SourcePath -Destination $StagingDirectory -Force
    }

    foreach ($RelativePath in $RuntimeDirectories) {
        $SourcePath = Join-Path $ProjectRoot $RelativePath
        if (-not (Test-Path -LiteralPath $SourcePath -PathType Container)) {
            throw "Required runtime directory is missing: $RelativePath"
        }
        Copy-Item -LiteralPath $SourcePath -Destination $StagingDirectory -Recurse -Force
    }

    Compress-Archive -Path (Join-Path $StagingDirectory '*') -DestinationPath $ArtifactPath -CompressionLevel Optimal -Force

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Archive = [System.IO.Compression.ZipFile]::OpenRead($ArtifactPath)
    try {
        $Entries = @($Archive.Entries | ForEach-Object { $_.FullName.Replace('\\', '/') })
    }
    finally {
        $Archive.Dispose()
    }

    $RequiredEntries = @(
        'plugin.json'
        'SettingsTemplate.yaml'
        'main.js'
        'src/application.js'
        'src/adapters.js'
        'Images/app.svg'
    )

    foreach ($RequiredEntry in $RequiredEntries) {
        if ($RequiredEntry -notin $Entries) {
            throw "Package validation failed; missing archive entry: $RequiredEntry"
        }
    }

    $ForbiddenPrefixes = @('test/', '.github/', 'scripts/', 'dist/', 'node_modules/')
    foreach ($Entry in $Entries) {
        if ($ForbiddenPrefixes.Where({ $Entry.StartsWith($_, [System.StringComparison]::OrdinalIgnoreCase) }).Count -gt 0) {
            throw "Package validation failed; development file was included: $Entry"
        }
    }

    [PSCustomObject]@{
        Artifact = $ArtifactPath
        Version  = $PluginManifest.Version
        Entries  = $Entries.Count
        Size     = (Get-Item -LiteralPath $ArtifactPath).Length
    }
}
finally {
    if (Test-Path -LiteralPath $TemporaryRoot) {
        Remove-Item -LiteralPath $TemporaryRoot -Recurse -Force
    }
}
