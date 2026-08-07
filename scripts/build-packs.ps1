# build-packs.ps1
# Exero Market directory packer (Beta3 unified market structure)
#
# What it does:
#   1. Create Market/action-packs/ + Market/lua-scripts/
#   2. Copy existing action-packs/*.exero-pack to Market/action-packs/
#   3. Build Lua scripts pack to Market/lua-scripts/lua-scripts-pack.exero-pack
#
# Usage (run from project root):
#   powershell -ExecutionPolicy Bypass -File scripts/build-packs.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Exero Market Packer ===" -ForegroundColor Cyan
Write-Host "Project root: $root"
Write-Host ""

# 1. Create Market subdirectories
$marketActionPacks = Join-Path $root "Market\action-packs"
$marketLuaScripts = Join-Path $root "Market\lua-scripts"
New-Item -ItemType Directory -Force -Path $marketActionPacks | Out-Null
New-Item -ItemType Directory -Force -Path $marketLuaScripts | Out-Null
Write-Host "[1/3] Created: Market\action-packs\, Market\lua-scripts\" -ForegroundColor Green

# 2. Copy existing action pack .exero-pack files
$sourceActionPacks = Join-Path $root "action-packs"
if (Test-Path $sourceActionPacks) {
    $copied = 0
    Get-ChildItem -Path $sourceActionPacks -Filter "*.exero-pack" | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $marketActionPacks -Force
        Write-Host "  Copied: $($_.Name)"
        $copied++
    }
    Write-Host "[2/3] Copied $copied action pack(s) to Market\action-packs\" -ForegroundColor Green
} else {
    Write-Host "[2/3] Skipped: action-packs\ not found" -ForegroundColor Yellow
}

# 3. Build Lua scripts pack
$luaManifest = Join-Path $root "scripts\lua-scripts-pack.json"
$luaScriptsDir = Join-Path $root "scripts"

if (-not (Test-Path $luaManifest)) {
    Write-Host "[3/3] Skipped: scripts\lua-scripts-pack.json not found" -ForegroundColor Yellow
} else {
    # Create temp directory
    $tempDir = Join-Path $env:TEMP "exero-lua-pack-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $tempScriptsDir = Join-Path $tempDir "scripts"
    New-Item -ItemType Directory -Force -Path $tempScriptsDir | Out-Null

    # Copy manifest.json to temp root
    Copy-Item -Path $luaManifest -Destination (Join-Path $tempDir "manifest.json") -Force

    # Copy .lua files to temp scripts\ subdirectory
    $luaFiles = @("hello-world.lua", "counter.lua", "system-info.lua")
    $included = 0
    foreach ($file in $luaFiles) {
        $src = Join-Path $luaScriptsDir $file
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $tempScriptsDir -Force
            Write-Host "  Included script: $file"
            $included++
        } else {
            Write-Host "  WARNING: script not found: $file" -ForegroundColor Yellow
        }
    }

    # Pack with .NET ZipFile (avoids Compress-Archive extension restriction)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $outputPath = Join-Path $marketLuaScripts "lua-scripts-pack.exero-pack"
    if (Test-Path $outputPath) {
        Remove-Item -Path $outputPath -Force
    }
    [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $outputPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    Write-Host "[3/3] Built: lua-scripts-pack.exero-pack ($included scripts) to Market\lua-scripts\" -ForegroundColor Green

    # Cleanup temp directory
    Remove-Item -Path $tempDir -Recurse -Force
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Directory structure:"
Write-Host "  Market\"
Write-Host "    action-packs\   (pack_type=action)"
Write-Host "    lua-scripts\    (pack_type=lua_scripts)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Review Market\ directory contents"
Write-Host "  2. Delete old action-packs\ directory if no longer needed"
Write-Host "  3. Delete old scripts\*.json (merged into lua-scripts-pack.json)"
Write-Host "  4. Push Market\ to GitHub repository"
