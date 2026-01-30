# build-launcher.ps1
# Builds CO21-Electron-Dev.exe from run-electron.ps1 using PS2EXE (Invoke-PS2EXE)
# Usage: run from project root in PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\build-launcher.ps1

$scriptDir = Split-Path $PSCommandPath
$input = Join-Path $scriptDir 'run-electron.ps1'
$output = Join-Path $scriptDir 'CO21-Electron-Dev.exe'
$icon = Join-Path $scriptDir 'public\icons\co21-logo.ico'

try {
    if (-not (Test-Path $input)) { throw "Input script not found: $input" }

    # Ensure PS2EXE available
    if (-not (Get-Command Invoke-PS2EXE -ErrorAction SilentlyContinue)) {
        Write-Output 'PS2EXE not found. Installing PS2EXE module from PSGallery (requires internet and consent) ...'
        Install-Module -Name PS2EXE -Scope CurrentUser -Force -AllowClobber
    }

    $invoke = Get-Command Invoke-PS2EXE -ErrorAction Stop
    Write-Output ('Building EXE: ' + $output)

    # Use -NoConsole so the EXE itself doesn't keep a console window (the batch will open its own console)
    Invoke-PS2EXE -InputFile $input -OutputFile $output -Icon $icon -NoConsole

    Write-Output ('Built: ' + $output)
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
