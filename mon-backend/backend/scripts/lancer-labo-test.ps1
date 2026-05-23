# Labo test multi-PC / mobile — à lancer sur le PC qui héberge le backend.
# Usage : cd mon-backend\backend ; .\scripts\lancer-labo-test.ps1

$ErrorActionPreference = "Stop"
$backendRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Split-Path $backendRoot -Parent
$dashboardRoot = Join-Path (Split-Path $repoRoot -Parent) "admin-dashboard"
if (-not (Test-Path $dashboardRoot)) {
  $dashboardRoot = Join-Path $repoRoot "admin-dashboard"
}

Write-Host ""
Write-Host "=== LE LOCATAIRE — labo test ===" -ForegroundColor Cyan

$ip = (
  Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -like "192.168.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object -First 1 -ExpandProperty IPAddress
)
if (-not $ip) { $ip = "192.168.x.x" }

Write-Host ""
Write-Host "1) Base de donnees + comptes demo" -ForegroundColor Yellow
Set-Location $backendRoot
npx prisma migrate deploy
npx ts-node scripts/seed-lia-demo.ts
npx ts-node scripts/seed-ai-memory.ts 2>$null

Write-Host ""
Write-Host "2) Ouvrir DEUX fenetres PowerShell et lancer :" -ForegroundColor Yellow
Write-Host "   Backend  : cd `"$backendRoot`" ; npm run start:dev"
Write-Host "   Dashboard: cd `"$dashboardRoot`" ; npm run dev"
Write-Host ""
Write-Host "3) URLs depuis les AUTRES appareils (meme Wi-Fi) :" -ForegroundColor Green
Write-Host "   Dashboard web : http://${ip}:5173"
Write-Host "   API (mobile)  : http://${ip}:3000"
Write-Host "   Swagger       : http://${ip}:3000/api"
Write-Host ""
Write-Host "4) Comptes demo (mot de passe apres le /) :" -ForegroundColor Green
Write-Host "   Referent V1 : demo.referent@lelocataire.test / DemoReferent1!"
Write-Host "   Bailleur    : demo.bailleur@lelocataire.test / DemoBailleur1!"
Write-Host "   Locataire   : demo.locataire@lelocataire.test / DemoLocataire1!"
Write-Host ""
Write-Host "5) Mobile Flutter : editer mobile\flutter\lib\config.dart" -ForegroundColor Yellow
Write-Host "   apiPhone = `"http://${ip}:3000`""
Write-Host ""
Write-Host "6) Avatar 2D : page Admin > Avatars (stockage local navigateur)." -ForegroundColor Yellow
Write-Host "   App mobile : conversation Lia (texte), pas encore avatar anime."
Write-Host ""
Write-Host "7) Pare-feu Windows : autoriser Node.js sur reseau prive si connexion refusee."
Write-Host ""
