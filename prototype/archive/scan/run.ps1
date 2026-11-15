# PULSAR SCAN — CSI map (OpenCV desktop), не камера / не браузер
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$pyCmd = $null
if (Get-Command py -ErrorAction SilentlyContinue) { $pyCmd = @("py", "-3") }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $pyCmd = @("python") }
else {
  Write-Host "Потрібен Python 3.10+. https://www.python.org/downloads/" -ForegroundColor Red
  exit 1
}

Write-Host "=== pip install ===" -ForegroundColor Cyan
& $pyCmd[0] $pyCmd[1..($pyCmd.Length-1)] -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($args.Count -eq 0) {
  Write-Host "=== serial ports ===" -ForegroundColor Cyan
  & $pyCmd[0] $pyCmd[1..($pyCmd.Length-1)] -u scan.py --list-ports
  Write-Host ""
  Write-Host "Запуск: .\run.ps1 --port COM11" -ForegroundColor Yellow
  Write-Host "Прошивка: firmware\csi_node\ (ESP32 DevKit V1)" -ForegroundColor Yellow
  exit 0
}

Write-Host "=== start scan.py (CSI) ===" -ForegroundColor Cyan
Write-Host "5с baseline: нікого між AP і ESP. Q = вихід." -ForegroundColor Yellow
& $pyCmd[0] $pyCmd[1..($pyCmd.Length-1)] -u scan.py @args
exit $LASTEXITCODE
