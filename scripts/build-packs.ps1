# build-packs.ps1
# Exero Market directory packer (Beta5 unified market structure)
#
# What it does:
#   1. Create Market/action-packs/ + Market/plugins/ directories
#   2. Copy existing action-packs/*.exero-pack to Market/action-packs/
#   3. Build Lua scripts pack to Market/action-packs/
#   4. Build Hello Plugin + Music Player packs to Market/plugins/
#   5. Generate Market/market-index.json by reading each pack's manifest
#
# Usage (run from project root):
#   powershell -ExecutionPolicy Bypass -File scripts/build-packs.ps1

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

# 3. Build Lua scripts pack
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

# 4. Build Hello Plugin pack
$helloPluginDir = Join-Path $root "examples\hello-plugin"
$helloManifest = Join-Path $helloPluginDir "manifest.json"
$helloIndex = Join-Path $helloPluginDir "index.html"
$dllName = "hello_plugin.dll"

if (-not (Test-Path $helloManifest)) {
    Write-Host "[4/5] Skipped: examples\hello-plugin\manifest.json not found" -ForegroundColor Yellow
} else {
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
        Write-Host "       Build first: cd examples\hello-plugin; cargo build --release" -ForegroundColor DarkGray
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

# 4b. Build Music Player pack
$musicPluginDir = Join-Path $root "examples\music-player"
$musicManifest = Join-Path $musicPluginDir "manifest.json"
$musicIndex = Join-Path $musicPluginDir "index.html"
$musicDllName = "music_player.dll"

if (-not (Test-Path $musicManifest)) {
    Write-Host "[4b/5] Skipped: examples\music-player\manifest.json not found" -ForegroundColor Yellow
} else {
    $dllPath = $null
    if ($env:CARGO_TARGET_DIR) {
        $candidate = Join-Path $env:CARGO_TARGET_DIR "release\$musicDllName"
        if (Test-Path $candidate) { $dllPath = $candidate }
    }
    if (-not $dllPath) {
        $candidate = Join-Path $musicPluginDir "target\release\$musicDllName"
        if (Test-Path $candidate) { $dllPath = $candidate }
    }

    if (-not $dllPath) {
        Write-Host "[4b/5] Skipped: $musicDllName not found" -ForegroundColor Yellow
        Write-Host "       Build first: cd examples\music-player; cargo build --release" -ForegroundColor DarkGray
    } else {
        $tempDir = Join-Path $env:TEMP "exero-music-player-$(Get-Date -Format 'yyyyMMddHHmmss')"
        New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

        Copy-Item -Path $musicManifest -Destination (Join-Path $tempDir "manifest.json") -Force
        Copy-Item -Path $musicIndex -Destination (Join-Path $tempDir "index.html") -Force
        Copy-Item -Path $dllPath -Destination (Join-Path $tempDir $musicDllName) -Force

        $outputPath = Join-Path $marketPlugins "music-player.exero-pack"
        if (Test-Path $outputPath) {
            Remove-Item -Path $outputPath -Force
        }
        [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $outputPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
        Write-Host "[4b/5] Built: music-player.exero-pack to Market\plugins\" -ForegroundColor Green

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

# Index action packs (foreach 而非 ForEach-Object，避免子作用域问题)
$actionPackFiles = Get-ChildItem -Path $marketActionPacks -Filter "*.exero-pack"
foreach ($packItem in $actionPackFiles) {
    $packFile = $packItem.FullName
    $fileName = $packItem.Name
    $fileSize = $packItem.Length

    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($packFile)
        $manifestEntry = $zip.GetEntry("manifest.json")
        if ($manifestEntry) {
            $reader = New-Object System.IO.StreamReader($manifestEntry.Open())
            $manifestJson = $reader.ReadToEnd()
            $reader.Close()
            $manifest = $manifestJson | ConvertFrom-Json

            $downloadUrl = "https://github.com/$githubOwner/$githubRepo/raw/main/Market/action-packs/$fileName"

            $packType = "action"
            if ($manifest.pack_type) {
                $packType = $manifest.pack_type
            }

            $entry = @{
                id = $manifest.id
                version = $manifest.version
                name = $manifest.name
                description = $manifest.description
                author = $manifest.author
                exero_api_version = $manifest.exero_api_version
                pack_type = $packType
                file_name = $fileName
                size = $fileSize
                action_count = $manifest.actions.Count
                has_sidebar = ($null -ne $manifest.sidebar)
                download_url = $downloadUrl
            }
            $actionEntries += $entry
            Write-Host "  Indexed: $($manifest.id) v$($manifest.version)"
        }
        $zip.Dispose()
    } catch {
        Write-Host ("  WARNING: Failed to read manifest from " + $fileName + ": " + $_) -ForegroundColor Yellow
    }
}

# Index plugins
$pluginFiles = Get-ChildItem -Path $marketPlugins -Filter "*.exero-pack" -ErrorAction SilentlyContinue
if ($pluginFiles) {
    foreach ($packItem in $pluginFiles) {
        $packFile = $packItem.FullName
        $fileName = $packItem.Name
        $fileSize = $packItem.Length

        try {
            $zip = [System.IO.Compression.ZipFile]::OpenRead($packFile)
            $manifestEntry = $zip.GetEntry("manifest.json")
            if ($manifestEntry) {
                $reader = New-Object System.IO.StreamReader($manifestEntry.Open())
                $manifestJson = $reader.ReadToEnd()
                $reader.Close()
                $manifest = $manifestJson | ConvertFrom-Json

                $downloadUrl = "https://github.com/$githubOwner/$githubRepo/raw/main/Market/plugins/$fileName"

                $packType = "action"
                if ($manifest.pack_type) {
                    $packType = $manifest.pack_type
                }

                $entry = @{
                    id = $manifest.id
                    version = $manifest.version
                    name = $manifest.name
                    description = $manifest.description
                    author = $manifest.author
                    exero_api_version = $manifest.exero_api_version
                    pack_type = $packType
                    file_name = $fileName
                    size = $fileSize
                    action_count = $manifest.actions.Count
                    has_sidebar = ($null -ne $manifest.sidebar)
                    download_url = $downloadUrl
                }
                $pluginEntries += $entry
                Write-Host "  Indexed plugin: $($manifest.id) v$($manifest.version)"
            }
            $zip.Dispose()
        } catch {
            Write-Host ("  WARNING: Failed to read manifest from " + $fileName + ": " + $_) -ForegroundColor Yellow
        }
    }
}

$index = @{
    actions = $actionEntries
    plugins = $pluginEntries
}

$indexPath = Join-Path $root "Market\market-index.json"
# PowerShell 5.1 的 ConvertTo-Json 在某些情况下返回空字符串（已知 bug）
# 使用 .NET JavaScriptSerializer 作为 fallback
$jsonContent = $index | ConvertTo-Json -Depth 10
if (-not $jsonContent -or $jsonContent.Length -eq 0) {
    Write-Host "  ConvertTo-Json returned empty, using JavaScriptSerializer fallback" -ForegroundColor Yellow
    Add-Type -AssemblyName System.Web.Extensions
    $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $serializer.MaxJsonLength = [int]::MaxValue
    $jsonContent = $serializer.Serialize($index)
    # 简单格式化缩进
    $jsonContent = $jsonContent.Replace(",", ",`n").Replace(":{", ":`n{").Replace(":[", ":`n[").Replace("}", "`n}")
}
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($indexPath, $jsonContent, $utf8NoBom)
Write-Host "[5/5] Generated: market-index.json ($($actionEntries.Count) actions, $($pluginEntries.Count) plugins)" -ForegroundColor Green

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
