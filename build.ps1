# Packages the plugin into build\zotero-open-with.xpi
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot
$outDir = Join-Path $root 'build'
$xpi = Join-Path $outDir 'zotero-open-with.xpi'

$include = @(
    'manifest.json',
    'bootstrap.js',
    'openWith.js',
    'prefs.js',
    'preferences.xhtml',
    'preferences.js',
    'locale',
    'icons'
)

New-Item -ItemType Directory -Force $outDir | Out-Null
if (Test-Path $xpi) { Remove-Item $xpi -Force }

$zip = [System.IO.Compression.ZipFile]::Open($xpi, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($entry in $include) {
        $path = Join-Path $root $entry
        if (-not (Test-Path $path)) { throw "Missing: $entry" }
        $files = if ((Get-Item $path).PSIsContainer) {
            Get-ChildItem $path -Recurse -File
        } else {
            Get-Item $path
        }
        foreach ($file in $files) {
            # Zip entry names must use forward slashes
            $name = [System.IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $file.FullName, $name, [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
            Write-Host "  + $name"
        }
    }
}
finally {
    $zip.Dispose()
}

Write-Host "Built $xpi"
