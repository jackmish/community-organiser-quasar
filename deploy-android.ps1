# deploy-android.ps1
# Build the Capacitor Android debug APK and install it on a connected device.
# Usage:  powershell -ExecutionPolicy Bypass -File .\deploy-android.ps1
#   -SkipBuild   skip the Quasar build step (just install the last APK)
#   -Release     build in release mode instead of debug

param(
    [switch]$SkipBuild,
    [switch]$Release
)

$projectRoot = Split-Path $PSCommandPath

# ── Load .env ────────────────────────────────────────────────────────────────
$envFile = Join-Path $projectRoot '.env'
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+)$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim())
        }
    }
}

$apkDebug   = Join-Path $projectRoot 'src-capacitor\android\app\build\outputs\apk\debug\app-debug.apk'
$apkRelease = Join-Path $projectRoot 'src-capacitor\android\app\build\outputs\apk\release\app-release-unsigned.apk'
$apk = if ($Release) { $apkRelease } else { $apkDebug }

# ── Locate ADB (ADB_PATH from .env → PATH → known SDK locations) ────────────
$adb = $null
$envAdb = [Environment]::GetEnvironmentVariable('ADB_PATH')
if ($envAdb -and (Test-Path $envAdb)) { $adb = $envAdb }

if (-not $adb) {
    $adb = Get-Command adb -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
}
if (-not $adb) {
    $candidates = @(
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
        "$env:ANDROID_HOME\platform-tools\adb.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $adb = $c; break }
    }
}
if (-not $adb) {
    Write-Error "adb not found. Set ADB_PATH in .env or add platform-tools to PATH."
    exit 1
}

# ── Check connected device ──────────────────────────────────────────────────
$rawOutput = & $adb devices 2>$null
$devices = $rawOutput | Select-String '^\S+\s+device$'
if (-not $devices) {
    Write-Host "`n  No Android device detected." -ForegroundColor Yellow
    Write-Host "  * Enable USB debugging on the phone"
    Write-Host "  * Connect via USB and accept the RSA prompt"
    Write-Host "  * Or pair wirelessly:  adb pair <ip>:<port>`n"
    exit 1
}
$deviceId = ($devices[0] -split '\s+')[0]
$deviceModel = (& $adb -s $deviceId shell getprop ro.product.model 2>$null).Trim()
Write-Host "Device: $deviceModel ($deviceId)" -ForegroundColor Cyan

# ── Build ────────────────────────────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host "`nBuilding Android APK..." -ForegroundColor Cyan
    $buildMode = if ($Release) { 'android-build' } else { 'android' }
    Push-Location $projectRoot
    try {
        npm run $buildMode
        if ($LASTEXITCODE -ne 0) { throw "Build failed (exit $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

# ── Install ──────────────────────────────────────────────────────────────────
if (-not (Test-Path $apk)) {
    Write-Error "APK not found at: $apk`nRun without -SkipBuild to build first."
    exit 1
}

$sizeMB = [math]::Round((Get-Item $apk).Length / 1MB, 1)
Write-Host "`nInstalling $([IO.Path]::GetFileName($apk)) (${sizeMB} MB) on $deviceModel..." -ForegroundColor Cyan

& $adb -s $deviceId install -r -t $apk 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "adb install failed (exit $LASTEXITCODE)"
    exit 1
}

Write-Host "`nInstalled on $deviceModel" -ForegroundColor Green

# ── Launch ───────────────────────────────────────────────────────────────────
$package = 'community.organiser'
$activity = '.MainActivity'
& $adb -s $deviceId shell am start -n "${package}/${package}${activity}" 2>$null | Out-Null
Write-Host "Launched $package`n" -ForegroundColor Green
