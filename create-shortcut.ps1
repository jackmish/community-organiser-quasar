# Create CO21-Electron-Dev.lnk shortcut pointing to CO21-Electron-Dev.bat
# Usage: Run this script from project root in PowerShell (may require execution policy)
$pw = (Get-Location).Path
$bat = Join-Path $pw 'CO21-Electron-Dev.bat'
$lnkPath = Join-Path $pw 'CO21-Electron-Dev.lnk'
$iconPath = Join-Path $pw 'public\icons\co21-logo.ico'

if (-not (Test-Path $bat)) {
    Write-Error ('Batch file not found: ' + $bat)
    exit 1
}
if (-not (Test-Path $iconPath)) {
    Write-Warning ('Icon not found at ' + $iconPath + ' - shortcut will use default icon.')
}

$sh = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut($lnkPath)
$lnk.TargetPath = $bat
$lnk.WorkingDirectory = $pw
$lnk.WindowStyle = 1
if (Test-Path $iconPath) { $lnk.IconLocation = $iconPath + ',0' }
$lnk.Save()
Write-Output ('Created shortcut: ' + $lnkPath)