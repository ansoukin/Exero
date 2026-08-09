# build-packs.ps1
# Exero Market directory packer (Beta5 unified market structure)
#
# What it does:
#   1. Create Market/action-packs/ + Market/plugins/ directories
#   2. Copy existing action-packs/*.exero-pack to Market/action-packs/
#   3. Build Lua scripts pack (new format: actions[] + executor_type=Lua) to Market/action-packs/
#   4. Build Hello Plugin pack (Phase 3 示例插件) to Market/plugins/
#   5. Generate Market/market-index.json by reading each pack's manifest
#
# Usage (run from project root):
#   powershell -ExecutionPolicy Bypass -File scripts/build-packs.ps1
#
# Hello Plugin 编译前置条件：
#   cd examples\hello-plugin
#   $env:CARGO_TARGET_DIR="C:\cargo-target-dominate"
#   cargo build --release

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Exero Market Packer (Beta5) ===" -ForegroundColor Cyan
Write-Host "Project root: $root"
Write-Host ""

# 1. Create Market directories
$marketActionPacks = Join-Path $root "Market\action-packs"
$marketPlugins = Join-Path $root "Market\plugins"
New-Item -ItemType Directory -Force -Path $marketActionPacks | Out-Null
New-Item -ItemType Directory -Force -Path $marketPlugins | Out-Null
Write-Host "[1/5] Created: Market\action-packs\, Market\plugins\" -ForegroundColor Green

# 2. Copy action pack .exero-pack files
$sourceActionPacks = Join-Path $root "action-packs"
$copied = 0
if (Test-Path $sourceActionPacks) {
    Get-ChildItem -Path $sourceActionPacks -Filter "*.exero-pack" | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $marketActionPacks -Force
        Write-Host "  Copied: $($_.Name)"
        $copied++
    }
}
Write-Host "[2/5] Copied $copied action pack(s) to Market\action-packs\" -ForegroundColor Green

# 3. Build Lua scripts pack (new format)
$luaManifest = Join-Path $root "scripts\lua-scripts-pack.json"
$luaScriptsDir = Join-Path $root "scripts"

if (-not (Test-Path $luaManifest)) {
    Write-Host "[3/5] Skipped: scripts\lua-scripts-pack.json not found" -ForegroundColor Yellow
} else {
    $tempDir = Join-Path $env:TEMP "exero-lua-pack-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $tempScriptsDir = Join-Path $tempDir "scripts"
    New-Item -ItemType Directory -Force -Path $tempScriptsDir | Out-Null

    Copy-Item -Path $luaManifest -Destination (Join-Path $tempDir "manifest.json") -Force

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

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $outputPath = Join-Path $marketActionPacks "lua-scripts-pack.exero-pack"
    if (Test-Path $outputPath) {
        Remove-Item -Path $outputPath -Force
    }
    [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $outputPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    Write-Host "[3/5] Built: lua-scripts-pack.exero-pack ($included scripts) to Market\action-packs\" -ForegroundColor Green

    Remove-Item -Path $tempDir -Recurse -Force
}

# 4. Build Hello Plugin pack (Phase 3 示例插件)
$helloPluginDir = Join-Path $root "examples\hello-plugin"
$helloManifest = Join-Path $helloPluginDir "manifest.json"
$helloIndex = Join-Path $helloPluginDir "index.html"
$dllName = "hello_plugin.dll"

if (-not (Test-Path $helloManifest)) {
    Write-Host "[4/5] Skipped: examples\hello-plugin\manifest.json not found" -ForegroundColor Yellow
} else {
    # 定位 .dll：优先 CARGO_TARGET_DIR，回退默认 target
    $dllPath = $null
    if ($env:CARGO_TARGET_DIR) {
        $candidate = Join-Path $env:CARGO_TARGET_DIR "release\$dllName"
        if (Test-Path $candidate) { $dllPath = $candidate }
    }
    if (-not $dllPath) {
        $candidate = Join-Path $helloPluginDir "target\release\$dllName"
        if (Test-Path $candidate) { $dllPath = $candidate }
    }

    if (-not $dllPath) {
        Write-Host "[4/5] Skipped: $dllName not found" -ForegroundColor Yellow
        Write-Host "       先在 examples\hello-plugin\ 下执行: cargo build --release" -ForegroundColor DarkGray
    } else {
        $tempDir = Join-Path $env:TEMP "exero-hello-plugin-$(Get-Date -Format 'yyyyMMddHHmmss')"
        New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

        Copy-Item -Path $helloManifest -Destination (Join-Path $tempDir "manifest.json") -Force
        Copy-Item -Path $helloIndex -Destination (Join-Path $tempDir "index.html") -Force
        Copy-Item -Path $dllPath -Destination (Join-Path $tempDir $dllName) -Force

        $outputPath = Join-Path $marketPlugins "hello-plugin.exero-pack"
        if (Test-Path $outputPath) {
            Remove-Item -Path $outputPath -Force
        }
        [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $outputPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
        Write-Host "[4/5] Built: hello-plugin.exero-pack to Market\plugins\" -ForegroundColor Green

        Remove-Item -Path $tempDir -Recurse -Force
    }
}

# 5. Generate market-index.json
Write-Host "[5/5] Generating market-index.json..." -ForegroundColor Cyan

Add-Type -AssemblyName System.IO.Compression.FileSystem
$githubOwner = "ansoukin"
$githubRepo = "Exero"
$actionEntries = @()
$pluginEntries = @()

# Index action packs
Get-ChildItem -Path $marketActionPacks -Filter "*.exero-pack" | ForEach-Object {
    $packFile = $_.FullName
    $fileName = $_.Name
    $fileSize = $_.Length

    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($packFile)
        $manifestEntry = $zip.GetEntry("manifest.json")
        if ($manifestEntry) {
            $reader = New-Object System.IO.StreamReader($manifestEntry.Open())
            $manifestJson = $reader.ReadToEnd()
            $reader.Close()
            $manifest = $manifestJson | ConvertFrom-Json

            $downloadUrl = "https://github.com/$githubOwner/$githubRepo/raw/main/Market/action-packs/$fileName"

            $entry = @{
                id = $manifest.id
                version = $manifest.version
                name = $manifest.name
                description = $manifest.description
                author = $manifest.author
                exero_api_version = $manifest.exero_api_version
                pack_type = if ($manifest.pack_type) { $manifest.pack_type } else { "action" }
                file_name = $fileName
                size = $fileSize
                action_count = $manifest.actions.Count
                has_sidebar = $null -ne $manifest.sidebar
                download_url = $downloadUrl
            }
            $actionEntries += $entry
            Write-Host "  Indexed: $($manifest.id) v$($manifest.version)"
        }
        $zip.Dispose()
    } catch {
        Write-Host "  WARNING: Failed to read manifest from ${fileName}: $_" -ForegroundColor Yellow
    }
}

# Index plugins (if any)
Get-ChildItem -Path $marketPlugins -Filter "*.exero-pack" -ErrorAction SilentlyContinue | ForEach-Object {
    $packFile = $_.FullName
    $fileName = $_.Name
    $fileSize = $_.Length

    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($packFile)
        $manifestEntry = $zip.GetEntry("manifest.json")
        if ($manifestEntry) {
            $reader = New-Object System.IO.StreamReader($manifestEntry.Open())
            $manifestJson = $reader.ReadToEnd()
            $reader.Close()
            $manifest = $manifestJson | ConvertFrom-Json

            $downloadUrl = "https://github.com/$githubOwner/$githubRepo/raw/main/Market/plugins/$fileName"

            $entry = @{
                id = $manifest.id
                version = $manifest.version
                name = $manifest.name
                description = $manifest.description
                author = $manifest.author
                exero_api_version = $manifest.exero_api_version
                pack_type = if ($manifest.pack_type) { $manifest.pack_type } else { "action" }
                file_name = $fileName
                size = $fileSize
                action_count = $manifest.actions.Count
                has_sidebar = $null -ne $manifest.sidebar
                download_url = $downloadUrl
            }
            $pluginEntries += $entry
            Write-Host "  Indexed plugin: $($manifest.id) v$($manifest.version)"
        }
        $zip.Dispose()
    } catch {
        Write-Host "  WARNING: Failed to read manifest from ${fileName}: $_" -ForegroundColor Yellow
    }
}

$index = @{
    actions = $actionEntries
    plugins = $pluginEntries
}

$indexPath = Join-Path $root "Market\market-index.json"
# 使用 .NET StreamWriter 写入无 BOM 的 UTF-8（PowerShell 5.1 的 Out-File -Encoding utf8 默认带 BOM，会导致 Rust serde_json 解析失败）
$jsonContent = $index | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($indexPath, $jsonContent, $utf8NoBom)
Write-Host "[5/5] Generated: market-index.json ($($actionEntries.Count) actions, $($pluginEntries.Count) plugins)" -ForegroundColor Green

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Directory structure:"
Write-Host "  Market\"
Write-Host "    market-index.json  (metadata index)"
Write-Host "    action-packs\      (pack_type=action)"
Write-Host "    plugins\           (pack_type=plugin)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Review Market\ directory contents"
Write-Host "  2. Clean up old Market\lua-scripts\ directory"
Write-Host "  3. Push Market\ to GitHub repository"
