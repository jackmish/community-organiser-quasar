# run-electron.ps1
# Small launcher that starts the CO21 Electron dev batch in a new cmd window
# This script is intended to be compiled to EXE via PS2EXE and pinned to the taskbar.

# Determine script/exe directory robustly (works when running as .ps1 or compiled .exe)
$scriptPath = $null
try { $scriptPath = $MyInvocation.MyCommand.Path } catch { $scriptPath = $null }
if (-not $scriptPath) { try { $scriptPath = $PSCommandPath } catch { } }
if (-not $scriptPath) { try { $scriptPath = $PSScriptRoot } catch { } }
if (-not $scriptPath) { try { $scriptPath = (Get-Location).Path } catch { } }

# If running as compiled EXE, use the process main module path
if (-not $scriptPath -or $scriptPath -eq '') {
    try {
        $procPath = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
        if ($procPath) { $scriptPath = $procPath }
    } catch {
        # ignore
    }
}

$scriptDir = Split-Path -Parent $scriptPath
$bat = Join-Path $scriptDir 'CO21-Electron-Dev.bat'

# Prefer the bat next to the exe; otherwise look up only to the project folder name
if (-not (Test-Path $bat)) {
    $projName = 'community-organiser-quasar'
    $cur = $scriptDir
    while ($cur) {
        if ((Split-Path $cur -Leaf) -ieq $projName) {
            $candidate = Join-Path $cur 'CO21-Electron-Dev.bat'
            if (Test-Path $candidate) { $bat = $candidate; $scriptDir = $cur; break }
            break
        }
        $parent = Split-Path $cur -Parent
        if (-not $parent -or $parent -eq $cur) { break }
        $cur = $parent
    }
    # last resort: check current working directory
    if (-not (Test-Path $bat)) {
        $cwdCandidate = Join-Path (Get-Location).Path 'CO21-Electron-Dev.bat'
        if (Test-Path $cwdCandidate) { $bat = $cwdCandidate; $scriptDir = (Get-Location).Path }
    }
    if (-not (Test-Path $bat)) { Write-Error ('Batch file not found: ' + $bat); exit 1 }
}

# Use cmd.exe to start the batch in a new console window (so the pinned launcher doesn't own the console)
$arg = '/c start "" "' + $bat + '"'
Start-Process -FilePath 'cmd.exe' -ArgumentList $arg -WorkingDirectory $scriptDir
