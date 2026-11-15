#Requires -Version 5.1
<#
.SYNOPSIS
  Встановлює залежності й запускає Pulsar (server + site).

.EXAMPLE
  .\start.ps1
  .\start.ps1 -Db
  .\start.ps1 -Demo
  .\start.ps1 -Com COM11
  .\start.ps1 -InstallOnly
#>
param(
  [switch]$Db,
  [switch]$Demo,
  [string]$Com = "",
  [switch]$InstallOnly
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Server = Join-Path $Root "server"
$Site = Join-Path $Root "site"
$Bridge = Join-Path $Root "bridge"

function Need-Node {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js не знайдено. Встановіть Node ≥ 18: https://nodejs.org/"
  }
  $v = (node -v) -replace "^v", ""
  $major = [int]($v.Split(".")[0])
  if ($major -lt 18) { throw "Потрібен Node ≥ 18 (зараз v$v)" }
  Write-Host "Node $(node -v)" -ForegroundColor DarkGray
}

function Npm-Install([string]$Dir, [string]$Label) {
  Write-Host "`n=== npm install · $Label ===" -ForegroundColor Cyan
  Push-Location $Dir
  try {
    if (-not (Test-Path "package.json")) { throw "Немає package.json у $Dir" }
    npm install
  } finally {
    Pop-Location
  }
}

function Start-InNewWindow([string]$Title, [string]$WorkDir, [string]$Command) {
  $escaped = $Command.Replace("'", "''")
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$WorkDir'; Write-Host '[$Title]' -ForegroundColor Green; $escaped"
  ) | Out-Null
}

Need-Node

Npm-Install $Server "prototype/server"
# site майже без deps, але lock/скрипт лишаємо
if (Test-Path (Join-Path $Site "package.json")) {
  Npm-Install $Site "prototype/site"
}
Npm-Install $Bridge "prototype/bridge (USB)"

if ($InstallOnly) {
  Write-Host "`nГотово: лише встановлення пакетів." -ForegroundColor Green
  exit 0
}

if ($Db) {
  Write-Host "`n=== MySQL (docker compose) ===" -ForegroundColor Cyan
  Push-Location $Server
  try {
    npm run db:up
  } catch {
    Write-Warning "Docker/db:up не вдався — сервер працюватиме в RAM. $_"
  } finally {
    Pop-Location
  }
}

Write-Host "`n=== Запуск процесів ===" -ForegroundColor Cyan
Start-InNewWindow "pulsar-server :4100" $Server "npm start"
Start-Sleep -Seconds 1
Start-InNewWindow "pulsar-site :4200" $Site "npm start"

if ($Demo) {
  Start-Sleep -Seconds 1
  Start-InNewWindow "pulsar-demo UDP" $Server "npm run demo"
}

if ($Com) {
  Start-Sleep -Seconds 1
  Write-Host "USB bridge → $Com (Serial Monitor має бути закритий)" -ForegroundColor Yellow
  Start-InNewWindow "pulsar-bridge $Com" $Bridge "npm run bt -- $Com"
}

Write-Host @"

────────────────────────────────────────
  PULSAR запущено

  Сайт екіпажу:     http://127.0.0.1:4200
  Панель сервера:   http://127.0.0.1:4100/panel
  Health:           http://127.0.0.1:4100/health

  /panel: sim + Emulate metrics + Medical card
  Watch (з -Com): LINK + CREW|… + REC|… → ESP

  Реальний годинник:
    .\start.ps1 -Com COM11
  Симуляція без заліза:
    .\start.ps1 -Demo
  Перед Upload в Arduino — закрийте bridge (COM busy).
────────────────────────────────────────
"@ -ForegroundColor Green
